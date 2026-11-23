import nodemailer from "nodemailer";
import type { IndicatorSnapshot } from "./analysis";
import { formatSigned, formatValue } from "./analysis";

const DEFAULT_TO = "byoungho.bae@bok.or.kr";

export function notificationRecipient(): string {
  return process.env.NOTIFY_EMAIL?.trim() || DEFAULT_TO;
}

function buildHtml(snapshots: IndicatorSnapshot[], updatedIds: string[]): string {
  const rows = snapshots
    .filter((s) => updatedIds.includes(s.id))
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.nameKo}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.period ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${formatValue(s.value, s.valueDigits)} ${s.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${formatSigned(s.delta, s.valueDigits)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.factorHeadline ?? "—"}</td>
      </tr>`,
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica Neue,Helvetica,Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:#0f172a;line-height:1.5;">
    <h1 style="font-size:20px;margin:0 0 8px;">Korean Macro Economic Perspective 업데이트</h1>
    <p style="margin:0 0 16px;color:#475569;">신규·갱신 지표 ${updatedIds.length}건이 반영되었습니다.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead>
        <tr style="background:#f1f5f9;text-align:left;">
          <th style="padding:8px 12px;">지표</th>
          <th style="padding:8px 12px;">기간</th>
          <th style="padding:8px 12px;">값</th>
          <th style="padding:8px 12px;">전기비</th>
          <th style="padding:8px 12px;">주요 요인</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:16px 0 0;color:#64748b;font-size:12px;">본 메일은 korea-macro-dashboard 자동 알림입니다.</p>
  </div>`;
}

export async function sendUpdateEmail(
  snapshots: IndicatorSnapshot[],
  updatedIds: string[],
): Promise<{ sent: boolean; mode: "smtp" | "dry-run"; to: string }> {
  const to = notificationRecipient();
  const subject = `[매크로 대시보드] ${updatedIds.length}개 지표 업데이트`;
  const html = buildHtml(snapshots, updatedIds);

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || "macro-dashboard@localhost";

  if (!host || !user || !pass) {
    console.log("[email:dry-run]", { to, subject, updatedIds });
    console.log(html);
    return { sent: false, mode: "dry-run", to };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  await transporter.sendMail({ from, to, subject, html });
  return { sent: true, mode: "smtp", to };
}
