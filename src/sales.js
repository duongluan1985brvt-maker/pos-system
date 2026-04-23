import { supabase, formatMoney } from './main.js';

let products = [];
let stockMap = {};
let cart = new Map();

// ================= INIT =================
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  document.getElementById('popup').addEventListener('click', function (e) {
    if (e.target.id === 'popup') {
      this.style.display = 'none';
    }
  });
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();

  const picker = document.getElementById('monthPicker');
  picker.value = `${y}-${m}`;

  updateMonthText();
});

// ================= LOAD =================
async function loadAll() {
  const { data: p } = await supabase.from('products').select('*');
  const { data: s } = await supabase.from('v_stock').select('*');

  products = p || [];

  stockMap = {};
  (s || []).forEach((x) => (stockMap[x.product_id] = x.stock));
  await loadStock();
  renderProducts();
}
document.getElementById('search').addEventListener('input', function (e) {
  const keyword = e.target.value.toLowerCase().trim();

  if (!keyword) {
    renderProducts();
    return;
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(keyword)
  );

  renderFilteredByGroup(filtered);
});
async function loadStock() {
  const { data } = await supabase
    .from('stock_movements')
    .select('product_id, type, qty');

  stockMap = {};

  if (!data) return;

  for (const x of data) {
    const qty = Number(x.qty || 0);

    if (!stockMap[x.product_id]) {
      stockMap[x.product_id] = 0;
    }

    if (x.type === 'IMPORT') stockMap[x.product_id] += qty;
    if (x.type === 'SALE') stockMap[x.product_id] -= qty;
  }
}
// ================= GROUP =================
function groupProducts() {
  const groups = {};
  products.forEach((p) => {
    const key = p.name.split(' ')[0].toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return groups;
}

// ================= RENDER PRODUCTS =================
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const groups = groupProducts();

  grid.innerHTML = Object.keys(groups)
    .map((key) => {
      const list = groups[key];
      const totalStock = list.reduce(
        (sum, p) => sum + (stockMap[p.id] || 0),
        0
      );

      return `
      <div class="product ${totalStock <= 0 ? 'out-stock' : ''}"
          onclick="handleProductClick('${key}')">

        <b>${key.toUpperCase()}</b>
        <div>${list.length} loại</div>

        <div style="color:${totalStock <= 0 ? 'red' : 'green'}">
          Tồn: ${totalStock} ${list[0].unit}
        </div>

        ${
          totalStock <= 0
            ? `<div style="color:red;font-weight:bold;">HẾT HÀNG</div>`
            : ''
        }

      </div>
    `;
    })
    .join('');
}

// ================= CLICK =================
window.handleProductClick = function (key) {
  const groups = groupProducts();
  const list = groups[key];

  if (list.length === 1) return addToCart(list[0].id);

  const box = document.getElementById('popupBox');

  box.innerHTML = list
    .map((p) => {
      const stock = stockMap[p.id] || 0;
      const isOut = stock <= 0;

      return `
        <div onclick="event.stopPropagation(); addToCart('${p.id}')"
          style="
            padding:8px;
            border-bottom:1px solid #eee;
            cursor:pointer;
            background:${isOut ? '#ffe5e5' : 'white'};
            color:${isOut ? 'red' : 'black'};
            font-weight:${isOut ? 'bold' : 'normal'};
          ">

          ${p.name} (${stock} ${p.unit})
          ${isOut ? ' ⚠️ HẾT HÀNG' : ''}

        </div>
      `;
    })
    .join('');

  document.getElementById('popup').style.display = 'flex';
};

// ================= COST =================
async function getCost(id) {
  const { data } = await supabase
    .from('stock_movements')
    .select('unit_cost')
    .eq('product_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0]?.unit_cost || 0;
}

// ================= ADD =================
window.addToCart = async function (id, qty = 1) {
  const popup = document.getElementById('popup');
  if (popup) popup.style.display = 'none';

  const p = products.find((x) => x.id === id);
  if (!p) return;

  const stock = stockMap[id] || 0;

  // ⚠️ CHỈ CẢNH BÁO 1 LẦN Ở ĐÂY
  if (stock <= 0) {
    alert('⚠️ Sản phẩm này đã HẾT HÀNG nhưng vẫn có thể bán!');
  }

  if (cart.has(id)) {
    cart.get(id).qty += qty;
  } else {
    const cost = await getCost(id);

    cart.set(id, {
      id,
      name: p.name,
      qty,
      price1: p.price_sell_1,
      price2: p.price_sell_2,
      unit: p.unit,
      import_price: cost,
      sellPrice: p.price_sell_2 ?? p.price_sell_1,
    });
  }

  renderCart();
};

// ================= FORMAT NUMBER =================
function parseNumber(val) {
  if (!val) return null;

  val = val.toString().trim();

  // ❌ bỏ toàn bộ dấu chấm (nghìn)
  val = val.replace(/\./g, '');

  // đổi dấu phẩy thành dấu chấm (thập phân chuẩn JS)
  val = val.replace(',', '.');

  const num = parseFloat(val);

  return isNaN(num) ? null : num;
}
function formatNumberPOS(num) {
  if (num === null || num === undefined || num === '') return '';

  let [intPart, decPart] = num.toString().split('.');

  // format hàng nghìn bằng dấu chấm
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // thập phân dùng dấu phẩy
  if (decPart) {
    return intPart + ',' + decPart;
  }

  return intPart;
}
function bindPOSInput(el) {
  el.addEventListener('input', () => {
    // ❌ không cho nhập dấu chấm
    el.value = el.value.replace(/[^0-9,]/g, '');
  });

  el.addEventListener('blur', () => {
    const num = parseNumber(el.value);
    el.value = num !== null ? formatNumberPOS(num) : '';
  });
}
// ================= UPDATE =================
window.updateQty = function (id, el) {
  const item = cart.get(id);
  if (!item) return;

  const num = parseNumber(el.value);

  if (num === null) {
    item.qty = null;
  } else {
    item.qty = num;
  }

  updateRow(id);
  updateTotal();
};

window.updatePrice = function (id, el) {
  const item = cart.get(id);
  if (!item) return;

  const num = parseNumber(el.value);

  if (num === null) {
    item.sellPrice = item.price2 ?? item.price1;
  } else {
    item.sellPrice = num;
  }

  updateRow(id);
  updateTotal();
};
window.handleBlurNumber = function (el) {
  const num = parseNumber(el.value);

  if (num === null) {
    el.value = '';
  } else {
    el.value = formatNumberPOS(num);
  }
};
window.removeItem = function (id) {
  cart.delete(id);
  renderCart();
};

// ================= UPDATE ROW =================
function updateRow(id) {
  const item = cart.get(id);
  const row = document.querySelector(`[data-id="${id}"]`);
  if (!row) return;

  const price = item.customPrice ?? item.price2 ?? item.price1;
  const qty = item.qty || 0;

  const sum = price * qty;

  row.querySelector('.line-total').innerText = formatMoney(sum);
}

// ================= TOTAL =================
function updateTotal() {
  let total = 0;
  let profit = 0;

  for (let item of cart.values()) {
    const price = item.sellPrice; // 🔥 GIÁ CHỐT DUY NHẤT
    const qty = item.qty || 0;

    total += price * qty;

    // 🔥 SO CHÍNH XÁC GIÁ VỐN
    profit += (price - Number(item.import_price || 0)) * qty;
  }

  document.getElementById('total').innerText = 'Tổng: ' + formatMoney(total);

  const el = document.getElementById('profit');

  el.innerText =
    profit < 0
      ? 'Lỗ: -' + formatMoney(Math.abs(profit))
      : 'Lãi: ' + formatMoney(profit);

  el.style.color = profit > 0 ? 'green' : profit < 0 ? 'red' : 'black';
}

// ================= RENDER CART =================
function renderCart() {
  const list = document.getElementById('cartList');

  let html = '';

  for (let item of cart.values()) {
    const defaultPrice = item.price2 ?? item.price1;

    html += `
      <div class="cart-item" data-id="${item.id}">
        
        <div style="display:flex;justify-content:space-between">
          <b>${item.name}</b>
          <button onclick="removeItem('${item.id}')">X</button>
        </div>

        <div>
          Giá:
          <input
            value="${item.customPrice ?? ''}"
            placeholder="${formatMoney(defaultPrice)}"
            oninput="updatePrice('${item.id}', this)"
            onblur="handleBlurNumber(this)">
        </div>

        <div>
          SL:
          <input
            value="${item.qty ?? ''}"
            oninput="updateQty('${item.id}', this)"
            onblur="handleBlurNumber(this)">
          ${item.unit}
        </div>

        <div class="line-total"><b>0 đ</b></div>
      </div>
    `;
  }

  list.innerHTML = html;

  updateTotal();
}

// ================= CHECKOUT =================
window.checkout = async function () {
  if (!cart || cart.size === 0) {
    alert("⚠️ Giỏ hàng trống");
    return;
  }
  for (let item of cart.values()) {
    if (!item.qty) {
      alert('Thiếu số lượng sản phẩm: ' + item.name);
      return;
    }

    const price = item.customPrice ?? item.price2 ?? item.price1;

    await supabase.from('stock_movements').insert([
      {
        product_id: item.id,
        type: 'SALE',
        qty: item.qty,
        unit_cost: price,
        total_cost: price * item.qty,
      },
    ]);

    stockMap[item.id] -= item.qty;
  }

  alert('Thanh toán thành công');

  cart.clear();
  renderCart();
  renderProducts();
};

function getGroupStock(list) {
  return list.reduce((sum, p) => {
    return sum + (stockMap[p.id] || 0);
  }, 0);
}

window.exportExcel = async function () {
  const picker = document.getElementById('monthPicker').value;
  if (!picker) return alert('Vui lòng chọn tháng!');

  const [year, month] = picker.split('-');

  const start = new Date(`${year}-${month}-01`).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from('stock_movements')
    .select(`*, products(name, unit)`)
    .eq('type', 'SALE')
    .gte('created_at', start)
    .lte('created_at', end);

  if (error || !data?.length) {
    alert('Không có dữ liệu');
    return;
  }

  // ===== GROUP =====
  const groupByDate = {};
  data.forEach((x) => {
    const date = new Date(x.created_at).toLocaleDateString('vi-VN');
    if (!groupByDate[date]) groupByDate[date] = [];
    groupByDate[date].push(x);
  });

  const sortedDates = Object.keys(groupByDate).sort((a, b) => {
    const [d1, m1, y1] = a.split('/');
    const [d2, m2, y2] = b.split('/');
    return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
  });

  // ===== EXCEL =====
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DoanhThu');

  // WIDTH
  ws.columns = [{ width: 35 }, { width: 53 }, { width: 35 }];

  const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const wrap = { vertical: 'middle', wrapText: true };

  // ===== HEADER =====
  ws.getCell('A1').value = 'HỘ, CÁ NHÂN KINH DOANH:';
  ws.getCell('A2').value = 'Địa chỉ:';
  ws.getCell('A3').value = 'Mã số thuế:';
  ['A1', 'A2', 'A3'].forEach((c) => (ws.getCell(c).font = { bold: true }));

  ws.getCell('B1').value = 'Hộ Kinh Doanh Hải Du';
  ws.getCell('B2').value = '34/5 Lương Văn Can, phường Vũng Tàu, TPHCM';
  ws.getCell('B3').value = '77085002359';
  ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].forEach((c) => {
    ws.getCell(c).alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true,
    };
  });
  ws.mergeCells('C1:C4');
  ws.getCell('C1').value =
    'Mẫu số S1a-HKD\n(Kèm theo Thông tư số 152/2025/TT-BTC\nngày 31 tháng 12 năm 2025\ncủa Bộ trưởng Bộ Tài chính)';
  ws.getCell('C1').alignment = center;
  // 🔥 chỉ set chiều cao dòng 4 (gánh toàn bộ khối C1:C4)
  ws.getRow(4).height = 35; // bạn chỉnh 90–120 tùy đẹp
  ws.mergeCells('A5:C5');
  ws.getCell('A5').value = 'SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ';
  ws.getCell('A5').font = { name: 'Times New Roman', size: 14, bold: true };
  ws.getCell('A5').alignment = center;
  ws.getRow(5).font = { bold: true };

  ws.mergeCells('A6:C6');
  ws.getCell('A6').value = 'Địa điểm kinh doanh: ...';
  ws.getCell('A6').alignment = center;

  ws.mergeCells('A7:C7');
  ws.getCell('A7').value = `Kỳ kê khai: Tháng ${month} năm ${year}`;
  ws.getCell('A7').alignment = center;

  ws.getCell('C8').value = 'Đơn vị tính:';
  ws.getCell('C8').alignment = center;

  // HEADER TABLE
  ws.getRow(9).values = ['Ngày tháng', 'Giao dịch', 'Số tiền'];
  ws.getRow(10).values = ['A', 'B', '1'];

  [9, 10].forEach((r) => {
    ws.getRow(r).alignment = center;
    ws.getRow(r).font = { bold: true };
  });

  // ===== DATA =====
  let row = 11;
  let totalAll = 0;

  sortedDates.forEach((date) => {
    let totalDay = 0;

    groupByDate[date].forEach((d) => {
      ws.getCell(`A${row}`).value = date;
      ws.getCell(
        `B${row}`
      ).value = `${d.products?.name} (${d.qty} ${d.products?.unit})`;
      ws.getCell(`C${row}`).value = d.total_cost;

      ws.getCell(`C${row}`).numFmt = '#,##0';
      totalDay += d.total_cost;
      row++;
    });

    ws.getCell(`B${row}`).value = 'Tổng ngày:';
    ws.getRow(row).font = { bold: true };
    ws.getCell(`C${row}`).value = totalDay;
    ws.getCell(`C${row}`).numFmt = '#,##0';
    row++;

    totalAll += totalDay;
  });

  // TOTAL
  ws.getCell(`B${row}`).value = 'Tổng cộng:';
  ws.getCell(`C${row}`).value = totalAll;
  ws.getCell(`C${row}`).numFmt = '#,##0';
  ws.getRow(row).font = { bold: true };
  row++;

  // FOOTER
  ws.mergeCells(`B${row}:C${row}`);
  ws.getCell(`B${row}`).value = 'VT, Ngày ..... Tháng ..... Năm ........';
  ws.getCell(`B${row}`).alignment = center;
  row++;

  ws.mergeCells(`B${row}:C${row}`);
  ws.getCell(`B${row}`).value =
    'NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/\nCÁ NHÂN KINH DOANH';
  ws.getCell(`B${row}`).font = {
    name: 'Times New Roman',
    size: 14,
    bold: true,
  };
  const textSign = ws.getCell(`B${row}`).value.toString();

  const linesSign = textSign.split('\n').length;
  const approxSign = Math.ceil(textSign.length / 25);

  const totalLinesSign = Math.max(linesSign, approxSign);

  ws.getRow(row).height = totalLinesSign * 18;
  ws.getCell(`B${row}`).alignment = center;
  ws.getRow(row).font = { bold: true };
  row++;

  ws.mergeCells(`B${row}:C${row}`);
  ws.getCell(`B${row}`).value = 'Đường Vũ Luân';
  ws.getCell(`B${row}`).font = {
    name: 'Times New Roman',
    size: 14,
    bold: true,
  };

  ws.getCell(`B${row}`).alignment = {
    horizontal: 'center',
    vertical: 'bottom',
    wrapText: true,
  };
  ws.getRow(row).font = { bold: true };

  // chiều cao dòng cuối
  ws.getRow(row).height = 105;

  // ===== WRAP TEXT ALL =====
  ws.eachRow((r) => {
    r.eachCell((c) => {
      c.alignment = { ...c.alignment, wrapText: true };
    });
  });

  // ===== BORDER =====
  // chỉ kẻ đến TRƯỚC 3 dòng cuối
  const endBorderRow = row - 3;

  for (let i = 9; i <= endBorderRow; i++) {
    for (let j = 1; j <= 3; j++) {
      ws.getCell(i, j).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }

  // ===== SAVE =====
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = {
        ...cell.font, // giữ lại bold / size 14 đã set
        name: 'Times New Roman',
        size: cell.font?.size || 13,
      };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `DoanhThu_${month}_${year}.xlsx`);
};

window.updateMonthText = function () {
  const val = document.getElementById('monthPicker').value;

  if (!val) {
    document.getElementById('monthText').innerText = '';
    return;
  }

  const [year, month] = val.split('-');
  
  document.getElementById('monthText').innerText = ` ${month}/${year}`;
};

function renderFilteredByGroup(list) {
  const grid = document.getElementById('productGrid');

  const groups = {};

  list.forEach(p => {
    const key = p.group || p.category || p.name.split(' ')[0]; 
    // 👆 phải giống groupProducts của bạn
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  grid.innerHTML = Object.keys(groups)
    .map(key => {
      const list = groups[key];

      const totalStock = list.reduce(
        (sum, p) => sum + (stockMap[p.id] || 0),
        0
      );

      return `
        <div class="product ${totalStock <= 0 ? 'out-stock' : ''}"
          onclick="handleProductClick('${key}')">

          <b>${key.toUpperCase()}</b>
          <div>${list.length} loại</div>

          <div style="color:${totalStock <= 0 ? 'red' : 'green'}">
            Tồn: ${totalStock} ${list[0].unit}
          </div>

          ${totalStock <= 0 ? `<div style="color:red;font-weight:bold;">HẾT HÀNG</div>` : ''}
        </div>
      `;
    })
    .join('');
}

import { logout } from "./auth.js";
window.logout = logout;
