import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ================= SUPABASE =================
export const supabase = createClient(
  'https://ycdcavjkozfyteteqakm.supabase.co',
  'sb_publishable_PjNx8eyTgjBnpHeGze1grQ_yhd2i1iL'
);

// ================= UTILS =================
export function escapeHTML(str = '') {
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[m])
  );
}

export function formatMoney(n) {
  if (n === null || n === undefined) return '0 đ';
  return Number(n).toLocaleString('vi-VN') + ' đ';
}

export function formatCurrencyInput(input) {
  if (!input) return;

  let value = input.value.replace(/\D/g, '');
  input.dataset.raw = value; // lưu số thật

  input.value = value
    ? Number(value).toLocaleString('vi-VN')
    : '';
}

export function normalizeName(name = '') {
  return name.trim().replace(/\s+/g, ' ');
}

export function getNumber(id) {
  const el = document.getElementById(id);
  if (!el) return null;

  let val = el.value;
  if (!val) return null;

  val = val.replace(/[^\d]/g, '');
  return val ? Number(val) : null;
}
