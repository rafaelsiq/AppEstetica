export default function ModalClose({ onClick }) {
  return (
    <button type="button" className="modal-close" aria-label="Fechar" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </svg>
    </button>
  );
}
