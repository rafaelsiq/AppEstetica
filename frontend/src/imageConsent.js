export const IMAGE_CONSENT_VERSION = "imagem-1";

export const IMAGE_CONSENT_TEXT = [
  "A clínica pede autorização para usar fotos feitas no seu atendimento.",
  "Se você autorizar, as fotos podem ficar no prontuário, para acompanhar a evolução, e também em materiais da clínica, como portfólio e redes sociais. Dados de saúde não entram nessa divulgação.",
  "Você pode não autorizar. Isso não muda o seu atendimento."
].join("\n\n");

export function consentDecisionLabel(link) {
  if (link?.imageUse === "autorizado") {
    return "Autorizado";
  }
  if (link?.imageUse === "negado") {
    return "Não autorizado";
  }
  return "Aguardando";
}
