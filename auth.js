export function initAuth() {
  const saved = localStorage.getItem("login");
  if (saved === "ok") return;

  showLoginPopup();
}

function showLoginPopup() {
  const div = document.createElement("div");
  div.id = "loginPopup";

  div.innerHTML = `
    <div style="
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center; z-index:9999;
    ">
      <div style="
        background:white; padding:20px; border-radius:12px;
        width:280px; box-shadow:0 10px 30px rgba(0,0,0,0.2);
      ">
        <h3 style="margin-top:0; text-align:center;">🔐 Đăng nhập</h3>

        <input id="loginUser" placeholder="Tài khoản" 
          style="width:100%; padding:10px; margin-top:10px; border-radius:8px; border:1px solid #ccc;" />

        <input id="loginPass" type="password" placeholder="Mật khẩu" 
          style="width:100%; padding:10px; margin-top:10px; border-radius:8px; border:1px solid #ccc;" />

        <button id="btnLogin" style="
          width:100%; padding:10px; margin-top:15px;
          border:none; border-radius:8px;
          background:#007bff; color:white; font-weight:bold;
        ">Đăng nhập</button>

        <p id="loginError" style="color:red; text-align:center; display:none; margin-top:10px;">
          Sai tài khoản hoặc mật khẩu
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(div);

  document.getElementById("btnLogin").onclick = handleLogin;
}

function handleLogin() {
  const USER = "admin";
  const PASS = "123456";

  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value.trim();

  if (u === USER && p === PASS) {
    localStorage.setItem("login", "ok");
    document.getElementById("loginPopup").remove();
  } else {
    document.getElementById("loginError").style.display = "block";
  }
}

export function logout() {
  localStorage.removeItem("login");
  location.reload();
}