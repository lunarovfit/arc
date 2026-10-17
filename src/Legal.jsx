// Política de privacidad y términos dentro de la app (los HTML viven en /public y también se publican en la web)
export function LegalSheet({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div className="legal" role="dialog" aria-label={doc === "privacidad" ? "Política de privacidad" : "Términos de uso"}>
      <div className="legal-top"><button className="link" onClick={onClose}>Cerrar</button></div>
      <iframe title={doc} src={`/${doc}.html`} />
    </div>
  );
}

export const LEGAL_CSS = `.legal{position:fixed;inset:0;z-index:40;background:#000;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)}
.legal-top{display:flex;justify-content:flex-end;padding:12px 18px;border-bottom:1px solid #26262B}
.inlink{background:none;border:0;padding:0;font:inherit;color:#D48B92;text-decoration:underline;cursor:pointer}
.legal-links{display:flex;gap:18px;flex-wrap:wrap;margin-top:6px}
.legal iframe{flex:1;border:0;width:100%;background:#000}`;
