export default function ModalClose({ onClick }) {
  return (
    <button type="button" className="modal-close" aria-label="Fechar" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
