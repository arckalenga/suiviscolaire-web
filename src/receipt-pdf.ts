import { logoData, schoolLogoPath } from "./school-branding";
import { jsPDF } from "jspdf";
import { drawReceipt } from "../supabase/functions/_shared/receipt-layout";
export async function makeReceipt(
  p: Record<string, any>,
  school: Record<string, any>,
  student: Record<string, any>,
) {
  const source = schoolLogoPath(school);
  return drawReceipt(
    new jsPDF(),
    p,
    school,
    student,
    source ? await logoData(source) : undefined,
  );
}
