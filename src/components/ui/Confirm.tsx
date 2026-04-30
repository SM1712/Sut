import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import Modal from './Modal';

interface ConfirmOpts {
  title: string;
  text?: string;
  confirmText?: string;
  danger?: boolean;
}

interface ConfirmCtx {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<ConfirmCtx>({ confirm: async () => false });

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOpts): Promise<boolean> => {
    return new Promise(resolve => setState({ opts, resolve }));
  }, []);

  const handleClose = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {state && (
        <Modal open onClose={() => handleClose(false)} title={state.opts.title}>
          {state.opts.text && <p className="confirm-text">{state.opts.text}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn--secondary" onClick={() => handleClose(false)}>Cancelar</button>
            <button
              className={`btn ${state.opts.danger !== false ? 'btn--danger' : 'btn--primary'}`}
              onClick={() => handleClose(true)}
              autoFocus
            >
              {state.opts.confirmText || 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
};

export const useConfirm = () => useContext(Ctx);
