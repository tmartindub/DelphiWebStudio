import getpass, io, os, pathlib, socket, stat, subprocess, sys, threading, uuid

# Optional integration test: install Paramiko into test-results/m6-sftp-server-deps
# and compile SftpConnectionSmoke into test-results/m6-sftp-build first.
base = pathlib.Path(__file__).resolve().parents[2] / 'test-results'
sys.path.insert(0, str(base / 'm6-sftp-server-deps'))
import paramiko

work = base / ('m6-local-sftp-' + uuid.uuid4().hex)
work.mkdir()
host_key = paramiko.RSAKey.generate(2048)
user_key = paramiko.RSAKey.generate(2048)
key_path = work / 'client_key'
user_key.write_private_key_file(str(key_path))
subprocess.run(['icacls', str(key_path), '/inheritance:r', '/grant:r', getpass.getuser() + ':(R,W)'], check=True, capture_output=True)
listener = socket.socket()
listener.bind(('127.0.0.1', 0))
listener.listen(1)
port = listener.getsockname()[1]
hosts_path = work / 'known_hosts'
hosts_path.write_text(f'[127.0.0.1]:{port} {host_key.get_name()} {host_key.get_base64()}\n', encoding='ascii')

class Server(paramiko.ServerInterface):
    def check_auth_publickey(self, username, key):
        return paramiko.AUTH_SUCCESSFUL if username == 'testuser' and key == user_key else paramiko.AUTH_FAILED
    def get_allowed_auths(self, username):
        return 'publickey'
    def check_channel_request(self, kind, channel_id):
        return paramiko.OPEN_SUCCEEDED if kind == 'session' else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

snapshot = b'{"format":"webstudio-website-manifest","version":1,"files":[]}'
files = {'/snapshot.json': snapshot, '/large.json': b'x' * (2 * 1024 * 1024 + 1)}
class Files(paramiko.SFTPServerInterface):
    def stat(self, path):
        if path not in files:
            return paramiko.SFTP_NO_SUCH_FILE
        result = paramiko.SFTPAttributes()
        result.st_mode = stat.S_IFREG | 0o444
        result.st_size = len(files[path])
        return result
    def lstat(self, path):
        return self.stat(path)
    def open(self, path, flags, attr):
        if path not in files or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC):
            return paramiko.SFTP_PERMISSION_DENIED
        handle = paramiko.SFTPHandle(flags)
        handle.readfile = io.BytesIO(files[path])
        return handle

def serve():
    try:
        for _ in range(4):
            connection, _ = listener.accept()
            transport = paramiko.Transport(connection)
            try:
                transport.add_server_key(host_key)
                transport.set_subsystem_handler('sftp', paramiko.SFTPServer, Files)
                transport.start_server(server=Server())
                while transport.is_active():
                    threading.Event().wait(0.05)
            except (OSError, EOFError, paramiko.SSHException):
                pass
            finally:
                transport.close()
    finally:
        listener.close()

thread = threading.Thread(target=serve, daemon=True)
thread.start()
exe = base / 'm6-sftp-build' / 'SftpConnectionSmoke.exe'
result = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path)], capture_output=True, text=True, timeout=30)
wrong_key = paramiko.RSAKey.generate(2048)
wrong_hosts = work / 'wrong_known_hosts'
wrong_hosts.write_text(f'[127.0.0.1]:{port} {wrong_key.get_name()} {wrong_key.get_base64()}\n', encoding='ascii')
rejected = subprocess.run([str(exe), str(port), str(key_path), str(wrong_hosts)], capture_output=True, text=True, timeout=30)
destination = work / 'downloaded snapshot.json'
download = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/snapshot.json', str(destination)], capture_output=True, text=True, timeout=30)
existing = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/snapshot.json', str(destination)], capture_output=True, text=True, timeout=30)
oversize_path = work / 'oversize.json'
oversize = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/large.json', str(oversize_path)], capture_output=True, text=True, timeout=30)
unsafe_path = work / 'unsafe.json'
unsafe = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/../snapshot.json', str(unsafe_path)], capture_output=True, text=True, timeout=30)
thread.join(timeout=5)
print(result.stdout, result.stderr)
if result.returncode or rejected.returncode == 0 or download.returncode or existing.returncode == 0 or oversize.returncode == 0 or unsafe.returncode == 0 or oversize_path.exists() or unsafe_path.exists() or not destination.exists() or destination.read_bytes() != snapshot or thread.is_alive():
    print(download.stdout, download.stderr, existing.stdout, existing.stderr)
    raise SystemExit('Local SFTP connection test failed')
print('Local SFTP connection and snapshot download passed; wrong host keys and overwrites were rejected. No files were uploaded.')
