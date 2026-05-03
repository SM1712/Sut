import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Upload, X, FileText, Image as ImageIcon,
  FileOutput, Download, Loader2, BookOpen, Monitor, Mail, Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';

/* ── Types ── */
interface FileEntry { id: string; file: File; type: 'image' | 'text'; preview?: string; }
type PageSize    = 'a4' | 'letter';
type Orientation = 'portrait' | 'landscape';

interface Preset {
  id: string;
  label: string;
  icon: React.ElementType;
  pageSize: PageSize;
  orientation: Orientation;
  margin: number;
  mergeAll: boolean;
  desc: string;
}

/* ── Constants ── */
const PAGE_DIMS: Record<PageSize, { w: number; h: number }> = {
  a4:     { w: 210, h: 297 },
  letter: { w: 216, h: 279 },
};

const PRESETS: Preset[] = [
  { id: 'doc',    label: 'Documento',    icon: BookOpen,    pageSize: 'a4',     orientation: 'portrait',  margin: 25, mergeAll: true,  desc: 'A4 vertical, márgenes amplios' },
  { id: 'photo',  label: 'Fotografías',  icon: ImageIcon,   pageSize: 'a4',     orientation: 'portrait',  margin: 5,  mergeAll: true,  desc: 'Imagen a página completa' },
  { id: 'slides', label: 'Presentación', icon: Monitor,     pageSize: 'a4',     orientation: 'landscape', margin: 12, mergeAll: true,  desc: 'A4 horizontal, estilo slides' },
  { id: 'letter', label: 'Carta',        icon: Mail,        pageSize: 'letter', orientation: 'portrait',  margin: 30, mergeAll: true,  desc: 'Carta US, márgenes generosos' },
  { id: 'multi',  label: 'Archivos sep.', icon: Layers,     pageSize: 'a4',     orientation: 'portrait',  margin: 15, mergeAll: false, desc: 'Un PDF por archivo' },
];

/* ── Helpers ── */
function uid() { return Math.random().toString(36).slice(2); }
function fileType(f: File): 'image' | 'text' | null {
  if (f.type.startsWith('image/')) return 'image';
  if (f.type === 'text/plain' || f.name.endsWith('.txt')) return 'text';
  return null;
}
function readAsDataURL(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });
}
function readAsText(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(f, 'utf-8'); });
}

/* ── Page preview component ── */
function PagePreview({
  pageSize, orientation, margin, files,
}: { pageSize: PageSize; orientation: Orientation; margin: number; files: FileEntry[] }) {
  const dims = PAGE_DIMS[pageSize];
  const pw   = orientation === 'portrait' ? dims.w : dims.h;
  const ph   = orientation === 'portrait' ? dims.h : dims.w;

  // Render at fixed display height
  const DISPLAY_H = 240;
  const scale     = DISPLAY_H / ph;
  const dw        = pw * scale;
  const dh        = ph * scale;
  const dm        = margin * scale;

  const imgFiles  = files.filter(f => f.type === 'image' && f.preview);
  const txtFiles  = files.filter(f => f.type === 'text');

  return (
    <div className="pdf-preview-wrap">
      <div
        className="pdf-page-preview"
        style={{ width: dw, height: dh }}
      >
        {/* Margin guide */}
        <div
          className="pdf-margin-area"
          style={{ inset: dm }}
        >
          {/* Image preview — first image fills the content area */}
          {imgFiles.length > 0 && (
            <img
              src={imgFiles[0].preview}
              className="pdf-preview-img"
              alt=""
            />
          )}

          {/* Text preview lines */}
          {imgFiles.length === 0 && txtFiles.length > 0 && (
            <div className="pdf-preview-lines">
              {Array.from({ length: Math.min(12, Math.floor((dh - dm * 2) / 10)) }).map((_, i) => (
                <div key={i} className="pdf-preview-line" style={{ width: i === 0 ? '70%' : i % 4 === 3 ? '45%' : '100%' }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {files.length === 0 && (
            <div className="pdf-preview-empty">
              <FileOutput size={20} />
              <span>Vista previa</span>
            </div>
          )}

          {/* Multiple files indicator */}
          {imgFiles.length > 1 && (
            <div className="pdf-preview-badge">+{imgFiles.length - 1} más</div>
          )}
        </div>

        {/* Size label */}
        <div className="pdf-page-label">{pageSize.toUpperCase()} · {orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</div>
      </div>

      {/* Margin indicator */}
      <div className="pdf-margin-info">
        <span>Margen: {margin} mm</span>
        <span>Área útil: {pw - margin * 2} × {ph - margin * 2} mm</span>
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function PDFConverterView() {
  const navigate  = useNavigate();
  const inputRef  = useRef<HTMLInputElement>(null);

  const [files, setFiles]             = useState<FileEntry[]>([]);
  const [dragging, setDragging]       = useState(false);
  const [activePreset, setActivePreset] = useState<string>('doc');
  const [pageSize, setPageSize]       = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margin, setMargin]           = useState(25);
  const [mergeAll, setMergeAll]       = useState(true);
  const [converting, setConverting]   = useState(false);
  const [done, setDone]               = useState(false);

  const applyPreset = (p: Preset) => {
    setActivePreset(p.id);
    setPageSize(p.pageSize);
    setOrientation(p.orientation);
    setMargin(p.margin);
    setMergeAll(p.mergeAll);
  };

  const addFiles = useCallback(async (raw: FileList | File[]) => {
    const arr   = Array.from(raw);
    const valid = arr.filter(f => fileType(f) !== null && !files.some(e => e.file.name === f.name && e.file.size === f.size));
    const entries: FileEntry[] = await Promise.all(valid.map(async f => {
      const t = fileType(f)!;
      const preview = t === 'image' ? await readAsDataURL(f) : undefined;
      return { id: uid(), file: f, type: t, preview };
    }));
    setFiles(prev => [...prev, ...entries]);
    setDone(false);
  }, [files]);

  const removeFile = (id: string) => setFiles(prev => prev.filter(e => e.id !== id));
  const clearAll   = () => { setFiles([]); setDone(false); };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const convert = async () => {
    if (!files.length) return;
    setConverting(true); setDone(false);
    try {
      const dims = PAGE_DIMS[pageSize];
      const w    = orientation === 'portrait' ? dims.w : dims.h;
      const h    = orientation === 'portrait' ? dims.h : dims.w;
      const ori  = orientation === 'portrait' ? 'p' : 'l';

      const generatePDF = async (entries: FileEntry[], filename: string) => {
        const doc   = new jsPDF({ orientation: ori, unit: 'mm', format: pageSize });
        let first   = true;
        for (const entry of entries) {
          if (!first) doc.addPage(); first = false;
          if (entry.type === 'image') {
            const dataUrl = entry.preview ?? await readAsDataURL(entry.file);
            const img     = new window.Image();
            await new Promise<void>(res => { img.onload = () => res(); img.src = dataUrl; });
            const availW  = w - margin * 2;
            const availH  = h - margin * 2;
            const ratio   = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
            const imgW    = img.naturalWidth  * ratio;
            const imgH    = img.naturalHeight * ratio;
            const x       = margin + (availW - imgW) / 2;
            const y       = margin + (availH - imgH) / 2;
            const ext     = entry.file.type === 'image/png' ? 'PNG' : entry.file.type === 'image/gif' ? 'GIF' : 'JPEG';
            doc.addImage(dataUrl, ext as 'PNG'|'JPEG'|'GIF', x, y, imgW, imgH);
          } else {
            const text  = await readAsText(entry.file);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(30, 20, 60);
            const lines = doc.splitTextToSize(text, w - margin * 2) as string[];
            let y       = margin + 4;
            for (const line of lines) {
              if (y + 6 > h - margin) { doc.addPage(); y = margin + 4; }
              doc.text(line, margin, y); y += 6;
            }
          }
        }
        doc.save(filename);
      };

      if (mergeAll) {
        await generatePDF(files, 'documento.pdf');
      } else {
        for (const entry of files)
          await generatePDF([entry], entry.file.name.replace(/\.[^.]+$/, '') + '.pdf');
      }
      setDone(true);
    } finally { setConverting(false); }
  };

  const hasFiles = files.length > 0;
  const imgCount = files.filter(f => f.type === 'image').length;
  const txtCount = files.filter(f => f.type === 'text').length;

  return (
    <div className="page-content">
      <button className="pomo-back" onClick={() => navigate('/tools')}>
        <ChevronLeft size={15} /> Herramientas
      </button>

      <motion.div className="pdf-layout" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>

        {/* ── Left column ── */}
        <div className="pdf-left">
          {/* Header */}
          <div className="pdf-page__head">
            <div className="pdf-page__icon-wrap"><FileOutput size={22} /></div>
            <div>
              <h2 className="pdf-page__title">Conversor a PDF</h2>
              <p className="pdf-page__sub">PNG · JPG · WEBP · GIF · BMP · TXT — sin subir nada a servidores</p>
            </div>
          </div>

          {/* Presets */}
          <div className="pdf-presets">
            <span className="pdf-section-label">Perfil de documento</span>
            <div className="pdf-preset-grid">
              {PRESETS.map(p => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    className={`pdf-preset-card${activePreset === p.id ? ' is-active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    <Icon size={18} />
                    <span className="pdf-preset-card__label">{p.label}</span>
                    <span className="pdf-preset-card__desc">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`pdf-drop${dragging ? ' is-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.txt"
              style={{ display: 'none' }} onChange={e => e.target.files && addFiles(e.target.files)} />
            <Upload size={28} className="pdf-drop__icon" />
            <p className="pdf-drop__main">Arrastra archivos aquí o haz clic</p>
            <p className="pdf-drop__sub">PNG · JPG · WEBP · GIF · BMP · TXT</p>
          </div>

          {/* File list */}
          <AnimatePresence>
            {hasFiles && (
              <motion.div className="pdf-file-list"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <div className="pdf-file-list__head">
                  <span className="pdf-file-list__count">
                    {files.length} archivo{files.length !== 1 ? 's' : ''}
                    {imgCount > 0 && ` · ${imgCount} imagen${imgCount !== 1 ? 'es' : ''}`}
                    {txtCount > 0 && ` · ${txtCount} texto${txtCount !== 1 ? 's' : ''}`}
                  </span>
                  <button className="pdf-clear-btn" onClick={clearAll}>Limpiar</button>
                </div>
                <div className="pdf-file-grid">
                  {files.map(entry => (
                    <motion.div key={entry.id} className="pdf-file-tile"
                      initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.16 }}>
                      {entry.type === 'image' && entry.preview
                        ? <img src={entry.preview} className="pdf-file-tile__img" alt="" />
                        : <div className="pdf-file-tile__txt-icon"><FileText size={24} /></div>}
                      <div className="pdf-file-tile__name" title={entry.file.name}>{entry.file.name}</div>
                      <button className="pdf-file-tile__remove" onClick={() => removeFile(entry.id)}><X size={11} /></button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fine-tune */}
          <details className="pdf-finetune">
            <summary className="pdf-finetune__summary">Ajuste fino</summary>
            <div className="pdf-options">
              <div className="pdf-opt-group">
                <span className="pdf-opt-label">Tamaño</span>
                <div className="pdf-opt-pills">
                  {(['a4', 'letter'] as PageSize[]).map(s => (
                    <button key={s} className={`pdf-pill${pageSize === s ? ' is-active' : ''}`}
                      onClick={() => { setPageSize(s); setActivePreset(''); }}>{s === 'a4' ? 'A4' : 'Carta'}</button>
                  ))}
                </div>
              </div>
              <div className="pdf-opt-group">
                <span className="pdf-opt-label">Orientación</span>
                <div className="pdf-opt-pills">
                  {(['portrait', 'landscape'] as Orientation[]).map(o => (
                    <button key={o} className={`pdf-pill${orientation === o ? ' is-active' : ''}`}
                      onClick={() => { setOrientation(o); setActivePreset(''); }}>{o === 'portrait' ? 'Vertical' : 'Horizontal'}</button>
                  ))}
                </div>
              </div>
              <div className="pdf-opt-group" style={{ gridColumn: '1 / -1' }}>
                <span className="pdf-opt-label">Margen · {margin} mm</span>
                <input type="range" min={0} max={40} step={1} value={margin} className="pdf-range"
                  onChange={e => { setMargin(Number(e.target.value)); setActivePreset(''); }} />
              </div>
              <div className="pdf-opt-group">
                <span className="pdf-opt-label">Resultado</span>
                <div className="pdf-opt-pills">
                  <button className={`pdf-pill${mergeAll ? ' is-active' : ''}`} onClick={() => setMergeAll(true)}>Un PDF</button>
                  <button className={`pdf-pill${!mergeAll ? ' is-active' : ''}`} onClick={() => setMergeAll(false)}>Separados</button>
                </div>
              </div>
            </div>
          </details>

          {/* Convert */}
          <button className="pdf-convert-btn" onClick={convert} disabled={!hasFiles || converting}>
            {converting
              ? <><Loader2 size={18} className="pdf-spinner" /> Generando…</>
              : done
              ? <><Download size={18} /> Descargar de nuevo</>
              : <><FileOutput size={18} /> Convertir a PDF</>}
          </button>

          <AnimatePresence>
            {done && (
              <motion.p className="pdf-done-msg" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                ✓ PDF generado y descargado correctamente
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right column: preview ── */}
        <motion.div
          className="pdf-right"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, delay: 0.1 }}
        >
          <span className="pdf-section-label">Vista previa</span>
          <div className="pdf-preview-panel">
            <PagePreview pageSize={pageSize} orientation={orientation} margin={margin} files={files} />

            <div className="pdf-preview-info">
              <div className="pdf-info-row">
                <span className="pdf-info-key">Formato</span>
                <span className="pdf-info-val">{pageSize.toUpperCase()} · {orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</span>
              </div>
              <div className="pdf-info-row">
                <span className="pdf-info-key">Dimensiones</span>
                <span className="pdf-info-val">
                  {orientation === 'portrait'
                    ? `${PAGE_DIMS[pageSize].w} × ${PAGE_DIMS[pageSize].h} mm`
                    : `${PAGE_DIMS[pageSize].h} × ${PAGE_DIMS[pageSize].w} mm`}
                </span>
              </div>
              <div className="pdf-info-row">
                <span className="pdf-info-key">Margen</span>
                <span className="pdf-info-val">{margin} mm por lado</span>
              </div>
              <div className="pdf-info-row">
                <span className="pdf-info-key">Área útil</span>
                <span className="pdf-info-val">
                  {orientation === 'portrait'
                    ? `${PAGE_DIMS[pageSize].w - margin * 2} × ${PAGE_DIMS[pageSize].h - margin * 2} mm`
                    : `${PAGE_DIMS[pageSize].h - margin * 2} × ${PAGE_DIMS[pageSize].w - margin * 2} mm`}
                </span>
              </div>
              <div className="pdf-info-row">
                <span className="pdf-info-key">Resultado</span>
                <span className="pdf-info-val">{mergeAll ? '1 PDF unificado' : `${files.length || '—'} PDFs separados`}</span>
              </div>
              {hasFiles && (
                <div className="pdf-info-row">
                  <span className="pdf-info-key">Páginas est.</span>
                  <span className="pdf-info-val">{mergeAll ? files.length : 1} pág. {mergeAll && files.length > 1 ? `(${files.length} archivos)` : ''}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
