import { supabase, formatMoney, normalizeName, getNumber } from './main.js';

let products = [];
let stockMap = {};
let lastCostValue = 0;

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  loadAll();

  document.getElementById('btnAdd').onclick = addProduct;
  document.getElementById('btnImport').onclick = importStock;
  // ===== CHẶN SCROLL + PHÍM TĂNG GIẢM =====
  [
    'stock',
    'import_price',
    'price1',
    'price2',
    'importQty',
    'importPrice',
    'importPrice1',
    'importPrice2',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // chặn scroll chuột
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
    });

    // chặn phím ↑ ↓
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      }
    });
  });
  [
    'import_price',
    'price1',
    'price2',
    'importPrice',
    'importPrice1',
    'importPrice2',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    // chỉ giữ số khi nhập
    el.addEventListener('input', () => {
      el.value = el.value.replace(/[^\d]/g, '');
    });

    // format khi rời ô
    el.addEventListener('blur', () => {
      formatCurrencyInput(el);
    });
  });
  const moneyInputs = [
    'import_price',
    'price1',
    'price2',
    'importPrice',
    'importPrice1',
    'importPrice2',
  ];

  moneyInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    let raw = '';

    el.addEventListener('input', (e) => {
      raw = e.target.value.replace(/\D/g, '');
      el.dataset.raw = raw;

      el.value = raw ? Number(raw).toLocaleString('vi-VN') : '';
    });

    el.addEventListener('blur', () => {
      if (!el.dataset.raw) return;
      el.value = Number(el.dataset.raw).toLocaleString('vi-VN');
    });
  });
  const unitSelect = document.getElementById('unit');
  const unitCustom = document.getElementById('unitCustom');

  unitSelect.addEventListener('change', () => {
    if (unitSelect.value === 'other') {
      unitCustom.style.display = 'block';
    } else {
      unitCustom.style.display = 'none';
      unitCustom.value = '';
    }
  });
  // Hiển thị tên + đơn vị khi chọn sản phẩm
  document.getElementById('importSelect').onchange = async function () {
    const id = this.value;
    const p = products.find((x) => x.id == id);

    document.getElementById('importName').innerText = p ? p.name : '';
    document.getElementById('importUnit').innerText = p ? p.unit : '';

    // ===== LẤY GIÁ VỐN GẦN NHẤT =====
    let lastCost = 0;

    const { data } = await supabase
      .from('stock_movements')
      .select('unit_cost')
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(1);
    lastCostValue = data && data.length ? data[0].unit_cost : 0;
    console.log('cost =', lastCostValue);
    document.getElementById('lastCost').innerText = formatMoney(lastCostValue);
    if (data && data.length) {
      lastCost = data[0].unit_cost;
    }

    document.getElementById('lastCost').innerText = formatMoney(lastCost);

    // ===== GIÁ BÁN HIỆN TẠI =====
    document.getElementById('currentPrice').innerText = formatMoney(
      p?.price_sell_1 || 0
    );

    // reset lãi
    document.getElementById('profitPreview').innerText = '0 đ';
  };
  document.getElementById('importPrice1').oninput = function () {
    const sell = getNumber('importPrice1') || 0;

    const costText = document.getElementById('lastCost').innerText;
    const cost = Number(costText.replace(/[^\d]/g, '')) || 0;

    const profit = sell - cost;

    const el = document.getElementById('profitPreview');

    el.innerText = formatMoney(profit);

    if (profit > 0) {
      el.style.color = 'green';
    } else if (profit < 0) {
      el.style.color = 'red';
    } else {
      el.style.color = 'black';
    }
  };
  document
    .getElementById('importPrice1')
    .addEventListener('input', function () {
      console.log('sell =', this.value);
      const sell = Number(this.value.replace(/[^\d]/g, '')) || 0;

      const profit = sell - lastCostValue;

      const el = document.getElementById('profitPreview');

      el.innerText = profit.toLocaleString('vi-VN') + ' đ';

      if (profit > 0) el.style.color = 'green';
      else if (profit < 0) el.style.color = 'red';
      else el.style.color = 'black';
    });
});

// ================= LOAD =================
async function loadAll() {
  await loadProducts();
  await loadStock();
  await loadHistory();
  render();
}

// ================= PRODUCTS =================
async function loadProducts() {
  const { data } = await supabase.from('products').select('*');
  products = data || [];

  const select = document.getElementById('importSelect');
  select.innerHTML = products
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join('');

  // Trigger hiển thị tên + đơn vị ngay lần đầu
  if (products.length > 0) {
    select.value = products[0].id;
    select.dispatchEvent(new Event('change'));
  }
}

// ================= STOCK =================
async function loadStock() {
  const { data } = await supabase
    .from('stock_movements')
    .select('product_id, type, qty');

  stockMap = {};

  (data || []).forEach((x) => {
    if (!stockMap[x.product_id]) stockMap[x.product_id] = 0;

    if (x.type === 'IMPORT') {
      stockMap[x.product_id] += Number(x.qty);
    }

    if (x.type === 'SALE') {
      stockMap[x.product_id] -= Number(x.qty);
    }
  });
}

// ================= RENDER =================
async function render() {
  const list = document.getElementById('list');

  let html = '';

  for (const p of products) {
    const stock = stockMap[p.id] || 0;

    // ===== LẤY GIÁ NHẬP GẦN NHẤT =====
    const { data } = await supabase
      .from('stock_movements')
      .select('unit_cost')
      .eq('product_id', p.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastCost = data && data.length ? data[0].unit_cost : 0;

    const totalValue = stock * lastCost;

    html += `
      <li style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        
        <div style="flex:1;min-width:200px;">
          <b>${p.name}</b><br>
          Tồn: ${stock} ${p.unit} |
          Giá nhập: ${formatMoney(lastCost)} |
          Tổng: ${formatMoney(totalValue)}
        </div>

        <div style="display:flex;gap:5px;">
          
        </div>

      </li>
    `;
  }

  list.innerHTML = html;
}

// ================= ADD PRODUCT =================
async function addProduct() {
  let nameRaw = document.getElementById('name').value;
  const nameCheck = normalizeName(nameRaw).toLowerCase();

  const stock = getNumber('stock');
  const unitSelect = document.getElementById('unit').value;
  const unitCustom = document.getElementById('unitCustom')?.value;

  const unit = unitSelect === 'other' ? unitCustom.trim() : unitSelect;

  if (!unit) {
    alert('Vui lòng nhập đơn vị');
    return;
  }
  const importPrice = getNumber('import_price');
  const price1 = getNumber('price1');
  const price2 = getNumber('price2');

  // ===== VALIDATE NAME =====
  if (!nameCheck) {
    alert(
      'Tên Sản phẩm không được để trống và không được trùng với sản phẩm cũ'
    );
    return;
  }

  const isDuplicate = products.some(
    (p) => normalizeName(p.name).toLowerCase() === nameCheck
  );

  if (isDuplicate) {
    alert(
      'Tên Sản phẩm không được để trống và không được trùng với sản phẩm cũ'
    );
    return;
  }

  // ===== VALIDATE NUMBER =====
  if (
    !stock ||
    stock <= 0 ||
    !importPrice ||
    importPrice <= 0 ||
    !price1 ||
    price1 <= 0
  ) {
    alert(
      'Số lượng, giá nhập, giá bán 1 không được để trống và phải lớn hơn 0'
    );
    return;
  }

  // ===== INSERT PRODUCT =====
  const { data, error } = await supabase
    .from('products')
    .insert([
      {
        name: nameRaw.trim(),
        unit: unit,
        price_sell_1: price1,
        price_sell_2: price2 || null,
      },
    ])
    .select();

  if (error) {
    alert('Lỗi thêm sản phẩm');
    return;
  }

  const productId = data[0].id;

  // ===== TẠO TỒN KHO BAN ĐẦU =====
  const res = await supabase.from('stock_movements').insert([
    {
      product_id: productId,
      type: 'IMPORT',
      qty: stock,
      unit_cost: importPrice,
      total_cost: stock * importPrice,
    },
  ]);

  if (res.error) {
    alert('Lỗi insert stock: ' + res.error.message);
    console.log(res.error);
    return;
  }

  alert('Thêm sản phẩm thành công');
  // ===== RESET FORM (SAU KHI XỬ LÝ XONG) =====
  setTimeout(() => {
    document.getElementById('name').value = '';
    document.getElementById('stock').value = '';

    const unitSelect = document.getElementById('unit');
    const unitCustom = document.getElementById('unitCustom');

    unitSelect.value = 'kg';
    unitCustom.value = '';
    unitCustom.style.display = 'none';

    document.getElementById('import_price').value = '';
    document.getElementById('price1').value = '';
    document.getElementById('price2').value = '';

    ['import_price', 'price1', 'price2'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.dataset.raw = '';
    });
  }, 0);

  // ===== reload UI =====
  loadAll();
}

// ================= IMPORT =================
async function importStock() {
  const productId = document.getElementById('importSelect').value;
  if (!productId) {
    alert('Vui lòng chọn sản phẩm');
    return;
  }

  const product = products.find((p) => p.id == productId);

  const qty = getNumber('importQty');
  let cost = getNumber('importPrice');
  let price1 = getNumber('importPrice1');
  let price2 = getNumber('importPrice2');

  // ===== VALIDATE QTY =====
  if (!qty || qty <= 0) {
    alert('Số lượng phải lớn hơn 0 và không được để trống');
    document.getElementById('importQty').focus();
    return;
  }

  // ===== STEP 1: GIÁ NHẬP =====
  if (!cost || cost <= 0) {
    // lấy giá nhập cũ gần nhất
    const { data } = await supabase
      .from('stock_movements')
      .select('unit_cost')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1);

    const oldCost = data && data.length ? data[0].unit_cost : 0;

    if (
      !confirm(
        '- Giá nhập (sẽ dùng giá cũ: ' +
          formatMoney(oldCost) +
          ')\n\nBạn có muốn tiếp tục không?'
      )
    ) {
      document.getElementById('importPrice').focus();
      return;
    }

    cost = oldCost;
  }

  // ===== STEP 2: GIÁ BÁN 1 =====
  if (!price1 || price1 <= 0) {
    const oldPrice1 = product.price_sell_1 || 0;

    if (
      !confirm(
        '- Giá bán 1 (sẽ dùng giá cũ: ' +
          formatMoney(oldPrice1) +
          ')\n\nBạn có muốn tiếp tục không?'
      )
    ) {
      document.getElementById('importPrice1').focus();
      return;
    }

    price1 = oldPrice1;
  }

  // ===== GIÁ BÁN 2 (OPTIONAL) =====
  if (!price2 || price2 <= 0) {
    price2 = product.price_sell_2;
  }

  // ===== INSERT STOCK =====
  const res = await supabase.from('stock_movements').insert([
    {
      product_id: productId,
      type: 'IMPORT',
      qty,
      unit_cost: cost,
      total_cost: qty * cost,
    },
  ]);

  if (res.error) {
    alert('Lỗi nhập kho: ' + res.error.message);
    console.log(res.error);
    return;
  }

  // ===== UPDATE GIÁ =====
  await supabase
    .from('products')
    .update({
      price_sell_1: price1,
      price_sell_2: price2 || null,
    })
    .eq('id', productId);

  // ===== SUCCESS =====
  alert('Nhập hàng thành công');

  // ===== RESET FORM =====
  document.getElementById('importQty').value = '';
  document.getElementById('importPrice').value = '';
  document.getElementById('importPrice1').value = '';
  document.getElementById('importPrice2').value = '';

  document.getElementById('importQty').focus();

  loadAll();
}
window.editHistory = async function (id) {
  // ===== LẤY DỮ LIỆU LỊCH SỬ =====
  const { data: m } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('id', id)
    .single();

  if (!m) return;

  // ===== LẤY SẢN PHẨM =====
  const { data: p } = await supabase
    .from('products')
    .select('*')
    .eq('id', m.product_id)
    .single();

  if (!p) return;

  // ===== INPUT =====
  const name = prompt('Tên sản phẩm:', p.name);
  if (name === null) return;

  const unit = prompt('Đơn vị:', p.unit);
  if (unit === null) return;

  const qty = prompt('Số lượng:', m.qty);
  if (qty === null) return;

  const cost = prompt('Giá nhập:', m.unit_cost);
  if (cost === null) return;

  const price1 = prompt('Giá bán hiện tại:', p.price_sell_1);
  if (price1 === null) return;

  // ===== UPDATE PRODUCT =====
  const { error: err1 } = await supabase
    .from('products')
    .update({
      name,
      unit,
      price_sell_1: Number(price1),
    })
    .eq('id', p.id);

  if (err1) {
    alert('Lỗi sản phẩm: ' + err1.message);
    return;
  }

  // ===== UPDATE STOCK MOVEMENT =====
  const { error: err2 } = await supabase
    .from('stock_movements')
    .update({
      qty: Number(qty),
      unit_cost: Number(cost),
      total_cost: Number(qty) * Number(cost),
    })
    .eq('id', id);

  if (err2) {
    alert('Lỗi tồn kho: ' + err2.message);
    return;
  }

  alert('Cập nhật thành công');
  loadAll();
};
window.deleteHistory = async function (id) {
  if (!confirm('Bạn chắc chắn muốn xóa lần nhập này?')) return;

  const { error } = await supabase
    .from('stock_movements')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Lỗi: ' + error.message);
    return;
  }

  alert('Đã xóa');
  loadAll();
};
async function loadHistory() {
  const { data } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5); // vẫn hiển thị 5

  const ul = document.getElementById('importHistory');

  ul.innerHTML = (data || [])
    .map((x, index) => {
      const p = products.find((p) => p.id == x.product_id);

      const time = x.created_at
        ? new Date(x.created_at).toLocaleString('vi-VN')
        : '';

      return `
        <li style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          
          <div style="flex:1;">
            <b>${p?.name || ''}</b>, 
            ${x.qty} ${p?.unit || ''}, <br>
            Nhập: ${formatMoney(x.unit_cost)}/${p?.unit || ''}, 
            Bán: ${formatMoney(p?.price_sell_1 || 0)}/${p?.unit || ''}, <br>
            <i>Lúc: ${time}</i>
          </div>

          ${
            index < 3
              ? `
              <div style="display:flex;gap:5px;">
                <button onclick="editHistory('${x.id}')">Sửa</button>
                <button style="background:red;" onclick="deleteHistory('${x.id}')">Xóa</button>
              </div>
            `
              : ''
          }

        </li>
      `;
    })
    .join('');
}

//phần import excel nhập hàng
window.downloadTemplate = function () {
  const ws = XLSX.utils.aoa_to_sheet([
    ['ten_sp', 'so_luong', 'don_vi', 'gia_nhap', 'gia_ban'],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MauNhapHang');

  XLSX.writeFile(wb, 'file_mau_nhap_hang.xlsx');
};

window.importExcel = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const items = rows.slice(1);

  if (!items.length) {
    alert('File rỗng');
    return;
  }

  for (let row of items) {
    let [name, qty, unit, importPrice, sellPrice] = row;

    if (!name) continue;

    const cleanInput = normalizeText(name);

    // =========================
    // AI MATCH PRODUCT
    // =========================
    let bestMatch = null;
    let bestScore = 0;

    for (let p of products) {
      const score = similarity(cleanInput, p.name);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    // =========================
    // THRESHOLD MATCH
    // =========================
    const MATCH_THRESHOLD = 0.75;

    let product = null;

    if (bestMatch && bestScore >= MATCH_THRESHOLD) {
      product = bestMatch;
    }
    // 🔥 UPDATE GIÁ BÁN NẾU ĐÃ TỒN TẠI
    if (product) {
      const updateData = {};
    
      if (sellPrice != null && sellPrice !== '') {
        updateData.price_sell_1 = Number(sellPrice);
      }
    
      if (unit && unit !== product.unit) {
        updateData.unit = unit;
      }
    
      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('products')
          .update(updateData)
          .eq('id', product.id);
    
        // cập nhật lại trong RAM luôn
        Object.assign(product, updateData);
      }
    }
    // =========================
    // CREATE NEW PRODUCT IF NO MATCH
    // =========================
    if (!product) {
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            name: name.trim(),
            unit,
            price_sell_1: sellPrice,
          },
        ])
        .select()
        .single();

      if (error) {
        console.log('CREATE PRODUCT ERROR:', error);
        continue;
      }

      product = data;
      products.push(product);
    }

    // =========================
    // ALWAYS IMPORT STOCK
    // =========================
    await supabase.from('stock_movements').insert([
      {
        product_id: product.id,
        type: 'IMPORT',
        qty: Number(qty),
        unit_cost: Number(importPrice),
        total_cost: Number(importPrice) * Number(qty),
      },
    ]);

    stockMap[product.id] = (stockMap[product.id] || 0) + Number(qty);
  }

  alert('✔ Nhập hàng theo file thành công');

  products = await loadProductsFromDB();
  renderProducts();
};
function normalizeText(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // bỏ dấu tiếng Việt
}
function similarity(a, b) {
  a = normalizeText(a);
  b = normalizeText(b);

  if (a === b) return 1;

  const matrix = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0)
  );

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }

  const distance = matrix[b.length][a.length];
  return 1 - distance / Math.max(a.length, b.length);
}
async function loadProductsFromDB() {
  const { data } = await supabase.from('products').select('*');
  return data || [];
}
import { logout } from "./auth.js";
window.logout = logout;
