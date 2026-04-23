
// ==========================
// SCAN INVOICE (FREE OCR)
// ==========================
window.scanInvoice = async function () {
  const file = document.getElementById("invoiceImage")?.files?.[0];

  if (!file) {
    alert("Chọn ảnh trước");
    return;
  }

  const text = await runOCR(file);

  console.log("OCR TEXT:", text);

  const items = parseInvoiceText(text);

  if (!items.length) {
    alert("Không đọc được dữ liệu");
    return;
  }

  window._invoiceItems = items;

  showPopup(items);
};


// ==========================
// OCR ENGINE (FREE)
// ==========================
function runOCR(file) {
  return new Promise((resolve, reject) => {
    Tesseract.recognize(file, "eng+vie", {
      logger: m => console.log(m)
    })
      .then(({ data }) => {
        resolve(data.text);
      })
      .catch(reject);
  });
}


// ==========================
// PARSE TEXT → ITEMS
// ==========================
function parseInvoiceText(text) {
  const lines = text.split("\n");

  const items = [];

  for (let line of lines) {
    line = line.trim();

    // bỏ dòng rác
    if (!line) continue;
    if (line.length < 5) continue;

    // regex: tên + số + số
    const match = line.match(/(.+?)\s+(\d+)\s+(\d+[\d.,]*)/);

    if (match) {
      const name = match[1].trim();
      const qty = Number(match[2]);
      const price = Number(match[3].replace(/,/g, ""));

      if (!isNaN(qty) && !isNaN(price)) {
        items.push({
          name,
          qty,
          price,
          amount: qty * price
        });
      }
    }
  }

  return items;
}


// ==========================
// POPUP REVIEW
// ==========================
function showPopup(items) {
  const box = document.getElementById("popupBox");
  const popup = document.getElementById("popup");

  let html = `<h3>KIỂM TRA ĐƠN HÀNG (FREE AI)</h3>`;

  let total = 0;

  html += `<div style="max-height:300px;overflow:auto">`;

  items.forEach(i => {
    total += i.amount;

    html += `
      <div style="padding:6px;border-bottom:1px solid #eee">
        ${i.name} | ${i.qty} × ${i.price} = <b>${i.amount}</b>
      </div>
    `;
  });

  html += `</div>`;

  html += `
    <hr>
    <b>TỔNG: ${total}</b>
    <br><br>

    <button onclick="confirmInvoice()">✔ OK</button>
    <button onclick="retryScan()">🔄 Chụp lại</button>
  `;

  box.innerHTML = html;
  popup.style.display = "flex";
}


// ==========================
// CONFIRM → ADD CART
// ==========================
window.confirmInvoice = function () {
  const items = window._invoiceItems || [];

  items.forEach(i => {
    const product = products.find(p =>
      p.name.toLowerCase().includes(i.name.toLowerCase())
    );

    if (product) {
      addToCart(product.id, i.qty);
    }
  });

  document.getElementById("popup").style.display = "none";
};


// ==========================
// RETRY
// ==========================
window.retryScan = function () {
  document.getElementById("popup").style.display = "none";
};