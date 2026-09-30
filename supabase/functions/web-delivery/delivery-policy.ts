export type DeliveryKind = "payment" | "staff_payment" | "mark" | "message";
export function eligibleRecipient(
  kind: DeliveryKind,
  event: Record<string, any>,
  contact: Record<string, any>,
  student?: Record<string, any> | null,
  hasMark = false,
) {
  if (event.school_id !== contact.school_id) return false;
  if (kind === "staff_payment")
    return !!contact.worker_id && event.worker_id === contact.worker_id;
  if (
    !student ||
    student.archived ||
    student.school_id !== contact.school_id ||
    contact.student_id !== student.id
  )
    return false;
  if (kind === "payment") return event.student_id === student.id;
  if (kind === "mark")
    return (
      event.published === true &&
      event.class_name === student.class_name &&
      hasMark
    );
  if (kind === "message")
    return (
      event.audience === "school" ||
      (event.audience === "class" && event.class_name === student.class_name) ||
      (event.audience === "student" && event.student_id === student.id)
    );
  return false;
}
export function deliveryText(
  kind: DeliveryKind,
  event: Record<string, any>,
  school: string,
  person: string,
) {
  const site = "https://suiviscolaire.info/#connexion";
  if (kind === "mark")
    return {
      subject: "Une nouvelle note est disponible",
      text:
        school +
        "\n" +
        person +
        " : une nouvelle note est disponible. Consultez votre espace scolaire.\n" +
        site,
    };
  if (kind === "message")
    return {
      subject: "Nouvelle communication de l’école",
      text:
        school +
        "\nUne nouvelle communication est disponible dans votre espace scolaire.\n" +
        site,
    };
  return {
    subject:
      kind === "payment"
        ? "Reçu de paiement scolaire"
        : "Confirmation de paiement au personnel",
    text: [
      school,
      person,
      event.label,
      "Date : " + event.paid_on,
      "Montant : " + Number(event.amount).toFixed(2) + " " + event.currency,
      "Référence : " + event.reference,
      "Identifiant : " + event.id,
      kind === "payment"
        ? "Votre reçu est également disponible dans votre espace scolaire.\n" +
          site
        : "Paiement enregistré par l’établissement.",
    ].join("\n"),
  };
}
