"""
ARN Stream - Windows Desktop Launcher & System Tray Manager
Developer: Abdou Ragab Nassar (ARN Technology)
Copyright (c) 2026 ARN Technology. All Rights Reserved.
"""

import sys
import os
import subprocess
import webbrowser
import time
import socket
import http.client
from pathlib import Path

from PyQt6.QtWidgets import (
    QApplication, QSystemTrayIcon, QMenu, QDialog, 
    QVBoxLayout, QHBoxLayout, QLabel, QPushButton
)
from PyQt6.QtGui import QIcon, QPixmap, QFont, QFontDatabase, QDesktopServices, QAction, QColor
from PyQt6.QtCore import Qt, QUrl, QTimer, QSize
from PyQt6.QtNetwork import QLocalServer, QLocalSocket

APP_NAME = "ARN Stream"
APP_VERSION = "2.0.0"
SERVER_PORT = 8096
SERVER_URL = f"http://localhost:{SERVER_PORT}"
SERVER_SOCKET_KEY = "ARN_Stream_SingleInstance_Server"
LEGACY_SERVER_SOCKET_KEY = "ARN_PersonalStream_SingleInstance_Server"


def get_base_dir():
    """Get executable directory or script directory reliably."""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def get_resource_path(relative_path):
    """Resolve resource path for both frozen and development environments."""
    filename = Path(relative_path).name
    candidates = []

    # 1. PyInstaller MEIPASS temporary unpacked folder (Onefile mode)
    if hasattr(sys, '_MEIPASS'):
        mei = Path(sys._MEIPASS)
        candidates.extend([
            mei / relative_path,
            mei / "assets" / filename,
            mei / "launcher" / filename,
            mei / "launcher" / "assets" / filename,
            mei / filename
        ])

    base = get_base_dir()

    # 2. Installed or workspace candidates
    candidates.extend([
        base / "_internal" / relative_path,
        base / "_internal" / "assets" / filename,
        base / "assets" / filename,
        base / relative_path,
        base / "launcher" / "assets" / filename,
        base / "launcher" / relative_path,
        base / filename
    ])

    for cand in candidates:
        if cand.exists():
            return str(cand).replace('\\', '/')

    return str(base / relative_path).replace('\\', '/')


class AboutDialog(QDialog):
    """ARN Technology Signature About Dialog."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"حول {APP_NAME}")
        self.setFixedSize(460, 480)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowType.WindowContextHelpButtonHint)

        # 1. Load and Register Cairo font from assets
        cairo_path = get_resource_path("assets/fonts/Cairo.ttf")
        if os.path.exists(cairo_path):
            QFontDatabase.addApplicationFont(cairo_path)

        # 2. Window Title Bar Icon
        icon_path = get_resource_path("assets/icon.ico")
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(QPixmap(icon_path)))

        self.setStyleSheet("""
            QDialog {
                background-color: #0b1120;
                border: 1px solid #1e293b;
                border-radius: 20px;
            }
            QLabel {
                color: #f8fafc;
                font-family: 'Cairo', 'Segoe UI', sans-serif;
            }
            QPushButton.closeBtn {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #e50914, stop:1 #b91c1c);
                color: #ffffff;
                font-family: 'Cairo', 'Segoe UI', sans-serif;
                font-weight: 700;
                font-size: 13px;
                border-radius: 20px;
                padding: 8px 40px;
                border: none;
            }
            QPushButton.closeBtn:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #f87171, stop:1 #dc2626);
            }
            QPushButton.closeBtn:pressed {
                background: #991b1b;
            }
            QPushButton.socialBtn {
                background-color: transparent;
                border: 1.5px solid #334155;
                border-radius: 25px;
                padding: 0px;
            }
            QPushButton.socialBtn:hover {
                background-color: #1e293b;
                border-color: #38bdf8;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(32, 28, 32, 28)
        layout.setSpacing(10)

        # 3. Logo (Ultra Sharp High-Res rendering)
        logo_png = get_resource_path("assets/icon.png")
        logo_ico = get_resource_path("assets/icon.ico")
        logo_lbl = QLabel()
        logo_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        pix = None
        if os.path.exists(logo_png):
            pix = QPixmap(logo_png)
        elif os.path.exists(logo_ico):
            # Extract crisp 256x256 layer from ICO
            pix = QIcon(logo_ico).pixmap(256, 256)

        if pix and not pix.isNull():
            scaled = pix.scaled(82, 82, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
            logo_lbl.setPixmap(scaled)
        layout.addWidget(logo_lbl)

        # Title
        title_lbl = QLabel(APP_NAME)
        title_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title_lbl.setStyleSheet("color: #f59e0b; font-size: 21px; font-weight: 800; font-family: 'Cairo', 'Segoe UI', sans-serif;")
        layout.addWidget(title_lbl)

        # Subtitle
        sub_lbl = QLabel(f"منصة الوسائط المتكاملة — إصدار {APP_VERSION}")
        sub_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sub_lbl.setStyleSheet("color: #94a3b8; font-size: 12px; font-weight: 500; font-family: 'Cairo', 'Segoe UI', sans-serif;")
        layout.addWidget(sub_lbl)

        layout.addSpacing(2)

        # Developer info (Signature ARN Green #10b981 per Rule 2)
        dev_lbl = QLabel("تطوير وبرمجة: عبده رجب نصار")
        dev_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        dev_lbl.setStyleSheet("color: #10b981; font-weight: 700; font-size: 14px; font-family: 'Cairo', 'Segoe UI', sans-serif;")
        layout.addWidget(dev_lbl)

        # Copyright (Signature ARN text per Rule 2)
        cr_lbl = QLabel("حقوق النشر (c) 2026 لشركة ARN Technology.\nجميع الحقوق محفوظة.")
        cr_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        cr_lbl.setStyleSheet("color: #64748b; font-size: 11px; font-family: 'Cairo', 'Segoe UI', sans-serif; line-height: 1.4;")
        layout.addWidget(cr_lbl)

        layout.addSpacing(6)

        # 4. Social Media Links Section (Circular Buttons with Icons per Rule 1)
        social_box = QHBoxLayout()
        social_box.setSpacing(14)
        social_box.setAlignment(Qt.AlignmentFlag.AlignCenter)

        social_links = [
            ("WhatsApp", "whatsapp.png", "https://wa.me/201556710314"),
            ("Telegram", "telegram.png", "https://t.me/ABDOURNASSAR95"),
            ("Facebook", "facebook.png", "https://www.facebook.com/abdouragab.nassar"),
            ("Messenger", "messenger.png", "https://m.me/abdouragab.nassar")
        ]

        for name, icon_file, url in social_links:
            btn = QPushButton()
            btn.setProperty("class", "socialBtn")
            btn.setFixedSize(50, 50)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setToolTip(name)
            
            icon_p = get_resource_path(f"assets/icons/{icon_file}")
            if os.path.exists(icon_p):
                btn.setIcon(QIcon(QPixmap(icon_p)))
                btn.setIconSize(QSize(28, 28))
            else:
                btn.setText(name[0])
                btn.setStyleSheet("color: #38bdf8; font-weight: bold; font-size: 14px;")

            btn.clicked.connect(lambda _, u=url: QDesktopServices.openUrl(QUrl(u)))
            social_box.addWidget(btn)

        layout.addLayout(social_box)

        layout.addSpacing(6)

        # Close button
        close_btn = QPushButton("إغلاق")
        close_btn.setProperty("class", "closeBtn")
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.clicked.connect(self.accept)
        layout.addWidget(close_btn, alignment=Qt.AlignmentFlag.AlignCenter)


class PersonalStreamTrayApp:
    def __init__(self, autostart=False):
        self.autostart = autostart
        self.server_proc = None
        self.base_dir = get_base_dir()

        self.setup_tray()
        self.start_server()

        # If user opened the app normally (not during Windows boot autostart), launch browser!
        if not self.autostart:
            self.tray_icon.showMessage(
                APP_NAME,
                "مرحباً بك في ARN Stream 👋 تم تشغيل الخادم بنجاح وجاري فتح المنصة...",
                QSystemTrayIcon.MessageIcon.Information,
                3500
            )
            QTimer.singleShot(1500, self.open_browser)
        else:
            self.tray_icon.showMessage(
                APP_NAME,
                "خادم ARN Stream يعمل الآن في الخلفية وجاهز للبث.",
                QSystemTrayIcon.MessageIcon.Information,
                3000
            )

    def find_node_executable(self):
        """Locate embedded node.exe or system node."""
        candidates = [
            self.base_dir / "bin" / "node.exe",
            self.base_dir / "_internal" / "bin" / "node.exe",
            self.base_dir / "node.exe",
            Path("C:/Program Files/nodejs/node.exe")
        ]
        for c in candidates:
            if c.exists():
                return str(c)
        return "node"

    def find_server_script(self):
        """Locate server/index.js."""
        candidates = [
            self.base_dir / "server" / "index.js",
            self.base_dir / "_internal" / "server" / "index.js",
            self.base_dir.parent / "server" / "index.js"
        ]
        for c in candidates:
            if c.exists():
                return str(c)
        return str(self.base_dir / "server" / "index.js")

    def is_server_alive(self):
        """Check if port 8096 responds to connection."""
        try:
            with socket.create_connection(('127.0.0.1', SERVER_PORT), timeout=0.8):
                return True
        except Exception:
            return False

    def start_server(self):
        """Spawn the background server process cleanly with no console window."""
        if self.is_server_alive():
            print("[TrayApp] Server is already running on port 8096.")
            return

        node_exe = self.find_node_executable()
        server_script = self.find_server_script()
        server_dir = str(Path(server_script).parent)

        creation_flags = 0
        if sys.platform == "win32":
            creation_flags = subprocess.CREATE_NO_WINDOW

        env = os.environ.copy()
        env["PORT"] = str(SERVER_PORT)
        env["NODE_ENV"] = "production"

        # Log server stdout/stderr to AppData for transparent diagnostics
        log_dir = Path(os.environ.get("APPDATA", ".")) / "ARN_Stream"
        log_dir.mkdir(parents=True, exist_ok=True)
        try:
            self.server_log_file = open(log_dir / "server.log", "a", encoding="utf-8", errors="replace")
        except Exception:
            self.server_log_file = subprocess.DEVNULL

        try:
            self.server_proc = subprocess.Popen(
                [node_exe, server_script],
                cwd=server_dir,
                env=env,
                creationflags=creation_flags,
                stdout=self.server_log_file,
                stderr=subprocess.STDOUT
            )
            print(f"[TrayApp] Server started with PID: {self.server_proc.pid}")
        except Exception as e:
            print(f"[TrayApp] Failed to spawn server: {e}")

    def stop_server(self):
        """Terminate background server on exit."""
        if self.server_proc:
            try:
                if sys.platform == "win32":
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(self.server_proc.pid)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    self.server_proc.terminate()
                    self.server_proc.wait(timeout=3)
            except Exception:
                pass
            self.server_proc = None
        if hasattr(self, 'server_log_file') and self.server_log_file and self.server_log_file != subprocess.DEVNULL:
            try:
                self.server_log_file.close()
            except Exception:
                pass
            self.server_log_file = None

    def open_browser(self):
        webbrowser.open(SERVER_URL)

    def open_live_tv(self):
        webbrowser.open(f"{SERVER_URL}/live")

    def trigger_scan(self):
        def do_scan():
            try:
                headers = {"Content-Type": "application/json"}
                try:
                    key_file = Path(os.environ.get("APPDATA", ".")) / "ARN_Stream" / ".internal_key"
                    if key_file.exists():
                        headers["X-ARN-Internal-Key"] = key_file.read_text(encoding="utf-8").strip()
                except Exception:
                    pass

                conn = http.client.HTTPConnection('127.0.0.1', SERVER_PORT, timeout=10)
                conn.request("POST", "/api/scan?async=true", body=b"{}", headers=headers)
                resp = conn.getresponse()
                conn.close()
                if resp.status == 200:
                    self.tray_icon.showMessage(APP_NAME, "تم بدء فحص ومزامنة المكتبة في الخلفية...", QSystemTrayIcon.MessageIcon.Information, 2500)
                elif resp.status in (401, 403):
                    self.tray_icon.showMessage(APP_NAME, "يتطلب فحص المكتبة صلاحيات المشرف أو إعادة تشغيل البرنامج.", QSystemTrayIcon.MessageIcon.Warning, 3500)
                else:
                    self.tray_icon.showMessage(APP_NAME, f"حالة الطلب: {resp.status}", QSystemTrayIcon.MessageIcon.Information, 2500)
            except Exception as e:
                self.tray_icon.showMessage(APP_NAME, f"تعذر الاتصال بالخادم: {e}", QSystemTrayIcon.MessageIcon.Warning, 2500)
        QTimer.singleShot(100, do_scan)

    def show_about(self):
        dlg = AboutDialog()
        dlg.exec()

    def quit_app(self):
        self.stop_server()
        QApplication.quit()

    def setup_tray(self):
        icon_path = get_resource_path("assets/icon.ico")
        if os.path.exists(icon_path):
            self.icon = QIcon(QPixmap(icon_path))
        else:
            self.icon = QApplication.style().standardIcon(QApplication.style().StandardPixmap.SP_MediaPlay)

        self.tray_icon = QSystemTrayIcon(self.icon)
        self.tray_icon.setToolTip(f"{APP_NAME} v{APP_VERSION} (ARN Technology)")

        # Menu
        self.menu = QMenu()
        self.menu.setStyleSheet("""
            QMenu {
                background-color: #0f172a;
                color: #f8fafc;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 4px;
                font-family: 'Segoe UI', 'Cairo', sans-serif;
                font-size: 13px;
            }
            QMenu::item {
                padding: 8px 24px;
                border-radius: 6px;
            }
            QMenu::item:selected {
                background-color: #e50914;
                color: white;
            }
            QMenu::separator {
                height: 1px;
                background-color: #334155;
                margin: 4px 8px;
            }
        """)

        open_action = QAction("🌐 فتح ARN Stream", self.menu)
        open_action.triggered.connect(self.open_browser)
        self.menu.addAction(open_action)

        live_action = QAction("📺 البث المباشر (Drama Live)", self.menu)
        live_action.triggered.connect(self.open_live_tv)
        self.menu.addAction(live_action)

        scan_action = QAction("🔍 فحص وتحديث المكتبة", self.menu)
        scan_action.triggered.connect(self.trigger_scan)
        self.menu.addAction(scan_action)

        self.menu.addSeparator()

        about_action = QAction("ℹ️ حول البرنامج", self.menu)
        about_action.triggered.connect(self.show_about)
        self.menu.addAction(about_action)

        self.menu.addSeparator()

        exit_action = QAction("❌ إيقاف السيرفر والخروج", self.menu)
        exit_action.triggered.connect(self.quit_app)
        self.menu.addAction(exit_action)

        self.tray_icon.setContextMenu(self.menu)
        self.tray_icon.activated.connect(self.on_tray_activated)
        self.tray_icon.show()

    def on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick or reason == QSystemTrayIcon.ActivationReason.Trigger:
            self.open_browser()


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)

    # 1. Single Instance check via QLocalSocket / QLocalServer
    socket = QLocalSocket()
    socket.connectToServer(SERVER_SOCKET_KEY)
    if not socket.waitForConnected(300):
        socket.connectToServer(LEGACY_SERVER_SOCKET_KEY)
    if socket.waitForConnected(300):
        # Already running! Send WAKEUP, then quit silently.
        socket.write(b"WAKEUP")
        socket.flush()
        socket.disconnectFromServer()
        sys.exit(0)

    # Start Single Instance server
    local_server = QLocalServer()
    # Remove previous dead socket if any
    QLocalServer.removeServer(SERVER_SOCKET_KEY)
    QLocalServer.removeServer(LEGACY_SERVER_SOCKET_KEY)
    local_server.listen(SERVER_SOCKET_KEY)

    autostart_flag = "--autostart" in sys.argv or "--silent" in sys.argv
    tray_manager = PersonalStreamTrayApp(autostart=autostart_flag)

    def handle_incoming_connection():
        client_sock = local_server.nextPendingConnection()
        if client_sock:
            if client_sock.waitForReadyRead(500):
                msg = client_sock.readAll().data()
                if b"WAKEUP" in msg:
                    tray_manager.open_browser()
            client_sock.disconnectFromServer()

    local_server.newConnection.connect(handle_incoming_connection)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
