import getpass, pathlib, socket, subprocess, sys, threading, uuid

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

def serve():
    try:
        for _ in range(2):
            connection, _ = listener.accept()
            transport = paramiko.Transport(connection)
            try:
                transport.add_server_key(host_key)
                transport.set_subsystem_handler('sftp', paramiko.SFTPServer, paramiko.SFTPServerInterface)
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
thread.join(timeout=5)
print(result.stdout, result.stderr)
if result.returncode or rejected.returncode == 0 or thread.is_alive():
    raise SystemExit('Local SFTP connection test failed')
print('Local SFTP connection passed and an incorrect host key was rejected; no files were uploaded.')
