import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, LogOut, Copy, Check, RefreshCw, Crown, History, ArrowRight, Wifi, UserCircle2, Link2, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import { useStore } from '../../store';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { getDB } from '../../lib/firebase';
import {
  uploadLocalToFirestore,
  hydrateFromFirestore,
  setSyncUid,
  subscribeToData,
  unsubscribeFromData,
} from '../../store/sync';
import {
  doc, getDoc, setDoc, arrayUnion, collection, getDocs,
} from 'firebase/firestore';
import { uid } from '../../lib/utils';
import type { SpaceHistoryEntry, SpaceMember } from '../../types';

interface Props { open: boolean; onClose: () => void; }

/** Returns first word of a display name, or first part of an email, or first 8 chars of uid. */
function shortLabel(member: SpaceMember | undefined, rawUid: string, currentUid: string | null): string {
  if (rawUid === currentUid) return 'Tú';
  if (!member) return rawUid.slice(0, 10) + '…';
  if (member.displayName) return member.displayName.split(' ')[0];
  if (member.email) return member.email.split('@')[0];
  return rawUid.slice(0, 10) + '…';
}

/** Full readable identifier for tooltip / secondary line. */
function fullLabel(member: SpaceMember | undefined, rawUid: string): string {
  if (!member) return rawUid;
  if (member.email) return member.email;
  return rawUid;
}

export default function SpacePanel({ open, onClose }: Props) {
  const meta              = useStore(s => s.meta);
  const setSpaceId        = useStore(s => s.setSpaceId);
  const addSpaceToHistory = useStore(s => s.addSpaceToHistory);
  const { toast }         = useToast();
  const { confirm }       = useConfirm();

  const [tab, setTab]           = useState<'join' | 'create'>('join');
  const [code, setCode]         = useState('');
  const [spaceName, setSpaceName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);

  // Members state
  const [members, setMembers]         = useState<string[]>([]);
  const [owner, setOwner]             = useState<string | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, SpaceMember>>({});
  const [membersLoading, setMembersLoading] = useState(false);

  const needsAuth    = !meta.uid;
  const spaceHistory = meta.spaceHistory || [];
  const otherSpaces  = spaceHistory.filter(e => e.code !== meta.spaceId);

  // ── Auto-load members when panel opens in active-space mode ────
  const loadMembers = useCallback(async (spaceId: string) => {
    setMembersLoading(true);
    try {
      const db = getDB();
      // Load space info (members list + owner)
      const snap = await getDoc(doc(db, 'spaces', spaceId, 'info', 'data'));
      if (snap.exists()) {
        const data = snap.data() as { members: string[]; owner: string };
        setMembers(data.members || []);
        setOwner(data.owner || null);
      }
      // Load member profiles (names/emails)
      try {
        const profilesSnap = await getDocs(collection(db, 'spaces', spaceId, 'memberProfiles'));
        const profiles: Record<string, SpaceMember> = {};
        profilesSnap.forEach(d => {
          const p = d.data() as SpaceMember;
          if (p.uid) profiles[p.uid] = p;
        });
        setMemberProfiles(profiles);
      } catch { /* memberProfiles may not exist on old spaces */ }
    } catch { /* silent */ }
    setMembersLoading(false);
  }, []);

  useEffect(() => {
    if (open && meta.spaceId) {
      loadMembers(meta.spaceId);
    }
    if (!meta.spaceId) {
      setMembers([]);
      setOwner(null);
      setMemberProfiles({});
    }
  }, [open, meta.spaceId, loadMembers]);

  // ── Write current user's profile to the space ──────────────────
  const writeMyProfile = async (spaceId: string) => {
    if (!meta.uid) return;
    try {
      await setDoc(
        doc(getDB(), 'spaces', spaceId, 'memberProfiles', meta.uid),
        {
          uid:         meta.uid,
          email:       meta.email       || '',
          displayName: meta.displayName || '',
          joinedAt:    new Date().toISOString(),
        } satisfies SpaceMember,
        { merge: true },
      );
    } catch { /* non-critical — UI degrades to uid display */ }
  };

  // ── Create ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (needsAuth) { toast('Inicia sesión primero', { type: 'warn' }); return; }
    if (!spaceName.trim()) return;
    setLoading(true);
    try {
      const db      = getDB();
      const newCode = uid('sp').slice(0, 6).toUpperCase();
      const infoRef = doc(db, 'spaces', newCode, 'info', 'data');

      await setDoc(infoRef, {
        name:      spaceName.trim(),
        code:      newCode,
        owner:     meta.uid,
        createdAt: new Date().toISOString(),
        members:   [meta.uid],
      });

      // Save last active space on user's profile
      await setDoc(
        doc(db, 'users', meta.uid!, '_profile', 'data'),
        { spaceId: newCode, spaceName: spaceName.trim() },
        { merge: true },
      );

      setSpaceId(newCode, spaceName.trim());
      addSpaceToHistory(newCode, spaceName.trim());

      // Write readable profile so members can see who we are
      await writeMyProfile(newCode);

      await uploadLocalToFirestore(meta.uid!, newCode);
      subscribeToData(meta.uid!, newCode);

      toast(`¡Espacio "${spaceName}" creado! Código: ${newCode}`, { type: 'success' });
      onClose();
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'permission-denied') {
        toast('Permiso denegado — actualiza las reglas de Firestore (ver firestore.rules en el proyecto).', { type: 'danger', duration: 8000 });
      } else {
        toast('Error al crear el espacio', { type: 'danger' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Join (internal, accepts explicit code) ─────────────────────
  const doJoin = async (joinCode: string) => {
    if (needsAuth) { toast('Inicia sesión primero', { type: 'warn' }); return; }
    const upperCode = joinCode.trim().toUpperCase();
    if (!upperCode) return;
    setLoading(true);
    try {
      const db       = getDB();
      const infoRef  = doc(db, 'spaces', upperCode, 'info', 'data');
      const infoSnap = await getDoc(infoRef);

      if (!infoSnap.exists()) {
        toast('Espacio no encontrado. Verifica el código.', { type: 'danger' });
        setLoading(false);
        return;
      }

      const info = infoSnap.data() as { name: string; owner: string; members: string[] };

      // Self-add to members array
      await setDoc(infoRef, { members: arrayUnion(meta.uid) }, { merge: true });

      // Save last active space on user's profile
      await setDoc(
        doc(db, 'users', meta.uid!, '_profile', 'data'),
        { spaceId: upperCode, spaceName: info.name },
        { merge: true },
      );

      setSpaceId(upperCode, info.name);
      setSyncUid(meta.uid!);
      addSpaceToHistory(upperCode, info.name);

      // Write readable profile (now we're a member, so we have write access)
      await writeMyProfile(upperCode);

      await hydrateFromFirestore(meta.uid!);
      subscribeToData(meta.uid!, upperCode);

      toast(`¡Entraste a "${info.name}"!`, { type: 'success' });
      onClose();
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'permission-denied') {
        toast('Permiso denegado — revisa las reglas de Firestore o pide acceso al admin del espacio.', { type: 'danger', duration: 9000 });
      } else {
        toast('Error al unirse al espacio', { type: 'danger' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => doJoin(code);

  // ── Switch to a history entry ──────────────────────────────────
  const handleSwitchTo = async (entry: SpaceHistoryEntry) => {
    if (meta.spaceId && meta.spaceId !== entry.code) {
      unsubscribeFromData();
      setSpaceId(null, '');
    }
    await doJoin(entry.code);
  };

  // ── Leave ─────────────────────────────────────────────────────
  const handleLeave = async () => {
    const ok = await confirm({
      title: '¿Salir del espacio?',
      text:  'Volverás a tus datos personales. Puedes volver a unirte con el mismo código cuando quieras.',
      confirmText: 'Salir',
    });
    if (!ok) return;

    if (meta.uid) {
      try {
        await setDoc(
          doc(getDB(), 'users', meta.uid, '_profile', 'data'),
          { spaceId: null, spaceName: '' },
          { merge: true },
        );
      } catch { /* silent */ }
    }

    unsubscribeFromData();
    setSpaceId(null, '');
    if (meta.uid) subscribeToData(meta.uid, null);

    toast('Saliste del espacio. Tus datos personales siguen intactos.', { type: 'info' });
    onClose();
  };

  const handleCopyCode = () => {
    if (!meta.spaceId) return;
    navigator.clipboard.writeText(meta.spaceId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={onClose} title="Espacios colaborativos" wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {meta.spaceId ? (
          /* ══ ACTIVE SPACE ════════════════════════════════════════════ */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

            {/* Space card */}
            <div style={{
              padding: 'var(--sp-4)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
            }}>
              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Users size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1, color: 'var(--accent)' }}>
                  {meta.spaceName || 'Espacio compartido'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: 'var(--success)',
                    animation: 'pulse-green 1.5s ease-out infinite', display: 'inline-block',
                  }} />
                  En vivo
                </span>
              </div>

              {/* Code + copy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-mute)' }}>Código de invitación:</span>
                <code style={{
                  fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700,
                  letterSpacing: '0.14em', background: 'var(--accent)', color: '#fff',
                  padding: '3px 12px', borderRadius: 'var(--radius-sm)',
                }}>
                  {meta.spaceId}
                </code>
                <button className="btn btn--secondary btn--sm" onClick={handleCopyCode}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>

              {/* Shared content notice */}
              <p style={{ fontSize: '0.8rem', color: 'var(--accent)', margin: 0, lineHeight: 1.5 }}>
                Comparte este código con tus compañeros para que se unan.
                Se sincronizan: tareas, cursos, etiquetas y eventos.
              </p>
            </div>

            {/* Members section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-soft)' }}>
                  Miembros{members.length > 0 ? ` (${members.length})` : ''}
                </span>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => meta.spaceId && loadMembers(meta.spaceId)}
                  disabled={membersLoading}
                >
                  <RefreshCw size={14} className={membersLoading ? 'anim-spin' : ''} />
                  {membersLoading ? 'Cargando…' : 'Actualizar'}
                </button>
              </div>

              {membersLoading && members.length === 0 ? (
                <div style={{ padding: 'var(--sp-4)', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.875rem' }}>
                  Cargando miembros…
                </div>
              ) : members.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {members.map((memberId) => {
                    const profile = memberProfiles[memberId];
                    const isMe    = memberId === meta.uid;
                    const isOwner = memberId === owner;
                    const label   = shortLabel(profile, memberId, meta.uid);
                    const sub     = fullLabel(profile, memberId);
                    return (
                      <div key={memberId} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-4)',
                        background: isMe ? 'var(--accent-soft)' : 'var(--surface-2)',
                        border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        {/* Avatar */}
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: isOwner ? 'var(--warn-soft)' : isMe ? 'var(--accent-soft)' : 'var(--bg-soft)',
                          color: isOwner ? 'var(--warn)' : isMe ? 'var(--accent)' : 'var(--text-mute)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.875rem', fontWeight: 700,
                        }}>
                          {isOwner ? <Crown size={14} /> : <UserCircle2 size={16} />}
                        </div>

                        {/* Name + email */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.9rem', fontWeight: isMe ? 600 : 500,
                            color: isMe ? 'var(--accent)' : 'var(--text)',
                          }}>
                            {label}
                          </div>
                          {sub !== label && (
                            <div style={{
                              fontSize: '0.75rem', color: 'var(--text-faint)',
                              fontFamily: sub.includes('@') ? 'inherit' : 'var(--font-mono)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {sub}
                            </div>
                          )}
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {isOwner && (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px',
                              borderRadius: 99, background: 'var(--warn-soft)', color: 'var(--warn)',
                            }}>
                              Admin
                            </span>
                          )}
                          {isMe && (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px',
                              borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent)',
                            }}>
                              Tú
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-faint)' }}>
                  Cargando lista de miembros…
                </p>
              )}
            </div>

            {/* Quick-switch to other spaces */}
            {otherSpaces.length > 0 && (
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 'var(--sp-2)' }}>
                  Cambiar a otro espacio:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {otherSpaces.map(entry => (
                    <button
                      key={entry.code}
                      className="btn btn--secondary btn--sm"
                      style={{ justifyContent: 'flex-start', gap: 'var(--sp-3)', textAlign: 'left' }}
                      onClick={() => handleSwitchTo(entry)}
                      disabled={loading}
                    >
                      <Wifi size={14} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{entry.name}</span>
                        <span style={{
                          color: 'var(--text-mute)', fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem', marginLeft: 8,
                        }}>
                          {entry.code}
                        </span>
                      </span>
                      <ArrowRight size={13} style={{ flexShrink: 0, color: 'var(--text-mute)' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn--danger" onClick={handleLeave} style={{ alignSelf: 'flex-start' }}>
              <LogOut size={16} /> Salir del espacio
            </button>
          </div>

        ) : (
          /* ══ NO ACTIVE SPACE ════════════════════════════════════════ */
          <>
            {/* Auth warning */}
            {needsAuth && (
              <div style={{
                padding: 'var(--sp-4)', background: 'var(--warn-soft)',
                border: '1px solid var(--warn)', borderRadius: 'var(--radius-sm)',
                color: 'var(--warn)', fontSize: '0.875rem', fontWeight: 500,
                display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start',
              }}>
                ⚠️ Necesitas iniciar sesión para usar espacios colaborativos.
                Ve a Cuenta → Iniciar sesión con Google.
              </div>
            )}

            {/* Recent spaces quick-access */}
            {spaceHistory.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
                  <History size={14} style={{ color: 'var(--text-mute)' }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-soft)' }}>
                    Espacios recientes
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {spaceHistory.map(entry => (
                    <button
                      key={entry.code}
                      onClick={() => handleSwitchTo(entry)}
                      disabled={loading || needsAuth}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                        padding: 'var(--sp-3) var(--sp-4)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: needsAuth ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.15s, background 0.15s',
                        opacity: needsAuth ? 0.5 : 1,
                      }}
                      onMouseEnter={e => {
                        if (!needsAuth) {
                          (e.currentTarget).style.borderColor = 'var(--accent)';
                          (e.currentTarget).style.background = 'var(--accent-soft)';
                        }
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget).style.borderColor = 'var(--border)';
                        (e.currentTarget).style.background = 'var(--surface)';
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-soft)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Users size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                          {entry.name}
                        </div>
                        <div style={{
                          fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                          color: 'var(--text-mute)', letterSpacing: '0.08em',
                        }}>
                          {entry.code}
                        </div>
                      </div>
                      <ArrowRight size={15} style={{ color: 'var(--text-mute)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', margin: 'var(--sp-4) 0 var(--sp-2)' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>o únete a otro espacio</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              </div>
            )}

            {/* Tabs: join / create */}
            <div style={{
              display: 'flex', gap: 3, background: 'var(--bg-soft)',
              padding: 3, borderRadius: 'var(--radius-sm)',
            }}>
              {(['join', 'create'] as const).map(t => (
                <button
                  key={t}
                  className={`cal-view-tab${tab === t ? ' is-active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setTab(t)}
                >
                  {t === 'join' ? <><Link2 size={13} /> Unirse</> : <><Sparkles size={13} /> Crear nuevo</>}
                </button>
              ))}
            </div>

            {tab === 'join' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Código del espacio</label>
                  <input
                    className="input"
                    placeholder="Ej: ABC123"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    style={{
                      letterSpacing: '0.12em', fontFamily: 'var(--font-mono)',
                      fontSize: '1.375rem', textAlign: 'center', fontWeight: 700,
                    }}
                    autoFocus={!('ontouchstart' in window)}
                  />
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>
                    Pídele el código al creador del espacio.
                  </p>
                </div>
                <button
                  className="btn btn--primary"
                  onClick={handleJoin}
                  disabled={loading || !code.trim() || needsAuth}
                >
                  {loading
                    ? <><RefreshCw size={16} className="anim-spin" /> Uniéndose…</>
                    : <><Plus size={16} /> Unirse al espacio</>
                  }
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                <div className="form-group">
                  <label className="form-label required">Nombre del espacio</label>
                  <input
                    className="input"
                    placeholder="Ej: Ciclo III — Grupo A"
                    value={spaceName}
                    onChange={e => setSpaceName(e.target.value)}
                    maxLength={40}
                    autoFocus={!('ontouchstart' in window)}
                  />
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-mute)' }}>
                    Se generará un código de 6 caracteres para invitar a otros.
                  </p>
                </div>
                <button
                  className="btn btn--primary"
                  onClick={handleCreate}
                  disabled={loading || !spaceName.trim() || needsAuth}
                >
                  {loading
                    ? <><RefreshCw size={16} className="anim-spin" /> Creando…</>
                    : <><Users size={16} /> Crear espacio</>
                  }
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
