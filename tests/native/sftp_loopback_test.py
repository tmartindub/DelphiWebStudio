import getpass, hashlib, io, json, os, pathlib, socket, stat, subprocess, sys, threading, uuid, zipfile

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
files = {'/snapshot.json': snapshot, '/large.json': b'x' * (2 * 1024 * 1024 + 1), '/site/index.html': b'Hello world!', '/site/assets/image.png': b'picture', '/site/empty.txt': b'', '/changed/file.txt': b'four', '/collisions/a.txt': b'x', '/collisions/A.txt': b'y', '/upload/existing.txt': b'existing user data'}
files.update({'/upload/update.txt': b'original update', '/upload/stale.txt': b'original stale', '/upload/race.txt': b'original race', '/upload/changed-original.txt': b'original change', '/upload/postverify-replace.txt': b'original postverify'})
files.update({'/upload/rollback-stale.txt': b'current stale', '/upload/.webstudio-original-stale.bak': b'original rollback stale', '/upload/rollback-race.txt': b'current race', '/upload/.webstudio-original-race.bak': b'original rollback race', '/upload/rollback-changed.txt': b'current changed', '/upload/.webstudio-original-changed.bak': b'original rollback changed', '/upload/rollback-postverify.txt': b'current postverify', '/upload/.webstudio-original-postverify.bak': b'original rollback postverify'})
directories = {'/upload', '/site', '/site/assets', '/site/emptydir'}
corrupt_next_upload = False
class Writer(paramiko.SFTPHandle):
    def __init__(self, path, flags):
        super().__init__(flags)
        self.path = path
    def write(self, offset, data):
        current = files[self.path]
        if offset != len(current):
            return paramiko.SFTP_FAILURE
        files[self.path] = current + data
        return paramiko.SFTP_OK

class Files(paramiko.SFTPServerInterface):
    def list_folder(self, path):
        if path not in ['/site', '/site/', '/site/assets', '/site/assets/', '/site/emptydir', '/site/emptydir/', '/links', '/links/', '/changed', '/changed/', '/collisions', '/collisions/', '/reserved', '/reserved/']:
            return paramiko.SFTP_NO_SUCH_FILE
        result = []
        items = [('index.html', stat.S_IFREG, 12), ('assets', stat.S_IFDIR, 0), ('empty.txt', stat.S_IFREG, 0), ('emptydir', stat.S_IFDIR, 0)] if path.rstrip('/') == '/site' else [('link', stat.S_IFLNK, 0)] if path.rstrip('/') == '/links' else [('file.txt', stat.S_IFREG, 3)] if path.rstrip('/') == '/changed' else [('a.txt', stat.S_IFREG, 1), ('A.txt', stat.S_IFREG, 1)] if path.rstrip('/') == '/collisions' else [('con.txt', stat.S_IFREG, 1)] if path.rstrip('/') == '/reserved' else [] if path.rstrip('/') == '/site/emptydir' else [('image.png', stat.S_IFREG, 7)]
        for name, mode, size in items:
            entry = paramiko.SFTPAttributes()
            entry.filename = name
            entry.st_mode = mode | 0o755
            entry.st_size = size
            result.append(entry)
        return result
    def stat(self, path):
        if path.rstrip('/') in directories or path == '/upload/link':
            result = paramiko.SFTPAttributes()
            result.st_mode = (stat.S_IFLNK if path == '/upload/link' else stat.S_IFDIR) | 0o755
            result.st_size = 0
            return result
        if path not in files:
            return paramiko.SFTP_NO_SUCH_FILE
        result = paramiko.SFTPAttributes()
        result.st_mode = stat.S_IFREG | 0o444
        result.st_size = len(files[path])
        return result
    def lstat(self, path):
        return self.stat(path)
    def mkdir(self, path, attr):
        if path == '/upload/racedir':
            directories.add(path)
            return paramiko.SFTP_FAILURE
        if not path.startswith('/upload/') or path.endswith('/deny') or path in directories or path in files or path.rsplit('/', 1)[0] not in directories:
            return paramiko.SFTP_PERMISSION_DENIED
        directories.add(path)
        return paramiko.SFTP_OK
    def open(self, path, flags, attr):
        if path.startswith('/upload/.webstudio-upload-') and flags & os.O_CREAT:
            if path in files:
                return paramiko.SFTP_FAILURE
            files[path] = b''
            return Writer(path, flags)
        if path not in files or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC):
            return paramiko.SFTP_PERMISSION_DENIED
        handle = paramiko.SFTPHandle(flags)
        content = files[path]
        if corrupt_next_upload and path.startswith('/upload/.webstudio-upload-') and content:
            content = b'X' + content[1:]
        handle.readfile = io.BytesIO(content)
        return handle
    def rename(self, oldpath, newpath):
        if oldpath not in files or newpath in files:
            return paramiko.SFTP_FAILURE
        files[newpath] = files.pop(oldpath)
        if oldpath == '/upload/race.txt':
            files[oldpath] = b'concurrent update'
        if oldpath == '/upload/changed-original.txt':
            files[newpath] = b'X' + files[newpath][1:]
        if oldpath == '/upload/rollback-race.txt':
            files[oldpath] = b'concurrent rollback'
        if oldpath == '/upload/rollback-changed.txt':
            files[newpath] = b'X' + files[newpath][1:]
        if newpath == '/upload/postverify.txt' and files[newpath]:
            files[newpath] = b'X' + files[newpath][1:]
        if newpath == '/upload/postverify-replace.txt' and oldpath.startswith('/upload/.webstudio-upload-'):
            files[newpath] = b'X' + files[newpath][1:]
        if newpath == '/upload/rollback-postverify.txt' and oldpath.startswith('/upload/.webstudio-original-'):
            files[newpath] = b'X' + files[newpath][1:]
        return paramiko.SFTP_OK

def serve():
    try:
        for _ in range(36):
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
inventory = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site'], capture_output=True, text=True, timeout=75)
links = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/links'], capture_output=True, text=True, timeout=75)
changed = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/changed'], capture_output=True, text=True, timeout=75)
scan_path = work / 'live destination scan.json'
scan = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(scan_path), 'save'], capture_output=True, text=True, timeout=75)
scan_contents = scan_path.read_bytes() if scan_path.exists() else b''
scan_existing = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(scan_path), 'save'], capture_output=True, text=True, timeout=75)
backup_path = work / 'destination backup.zip'
backup = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(backup_path), 'backup', 'zip'], capture_output=True, text=True, timeout=75)
backup_contents = backup_path.read_bytes() if backup_path.exists() else b''
backup_existing = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(backup_path), 'backup', 'zip'], capture_output=True, text=True, timeout=75)
links_backup_path = work / 'links.zip'
links_backup = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/links', str(links_backup_path), 'backup', 'zip'], capture_output=True, text=True, timeout=75)
collision_path = work / 'collisions.zip'
collision_backup = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/collisions', str(collision_path), 'backup', 'zip'], capture_output=True, text=True, timeout=75)
reserved_path = work / 'reserved.zip'
reserved_backup = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/reserved', str(reserved_path), 'backup', 'zip'], capture_output=True, text=True, timeout=75)
local_file = work / 'transfer fixture.txt'
local_data = b'synthetic test data ' * 300
local_file.write_bytes(local_data)
transfer = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', 'new.txt', str(local_file), 'test', 'only'], capture_output=True, text=True, timeout=75)
collision = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', 'existing.txt', str(local_file), 'test', 'only'], capture_output=True, text=True, timeout=75)
corrupt_next_upload = True
corrupt = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', 'corrupt.txt', str(local_file), 'test', 'only'], capture_output=True, text=True, timeout=75)
corrupt_next_upload = False
postverify = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', 'postverify.txt', str(local_file), 'test', 'only'], capture_output=True, text=True, timeout=75)
empty_file = work / 'empty transfer.txt'
empty_file.write_bytes(b'')
empty_transfer = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', 'empty.txt', str(empty_file), 'test', 'only'], capture_output=True, text=True, timeout=75)
def replace(name, original, expected_hash=None):
    return subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', name, str(local_file), str(len(original)), expected_hash or hashlib.sha256(original).hexdigest(), 'test', 'only'], capture_output=True, text=True, timeout=75)
replacement = replace('update.txt', b'original update')
stale = replace('stale.txt', b'original stale', '0' * 64)
race = replace('race.txt', b'original race')
changed_original = replace('changed-original.txt', b'original change')
postverify_replacement = replace('postverify-replace.txt', b'original postverify')
receipt_parts = replacement.stdout.strip().split('|')
replacement_ok = len(receipt_parts) == 4 and receipt_parts[:3] == ['/upload/update.txt', str(len(local_data)), hashlib.sha256(local_data).hexdigest()] and files.get(receipt_parts[3]) == b'original update' and files.get('/upload/update.txt') == local_data
def rollback(name, previous, current, original, current_hash=None):
    return subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', name, previous, str(len(current)), current_hash or hashlib.sha256(current).hexdigest(), str(len(original)), hashlib.sha256(original).hexdigest(), 'test'], capture_output=True, text=True, timeout=75)
rollback_ok = rollback('update.txt', receipt_parts[3].rsplit('/', 1)[-1] if len(receipt_parts) == 4 else 'invalid', local_data, b'original update')
rollback_stale = rollback('rollback-stale.txt', '.webstudio-original-stale.bak', b'current stale', b'original rollback stale', '0' * 64)
rollback_race = rollback('rollback-race.txt', '.webstudio-original-race.bak', b'current race', b'original rollback race')
rollback_changed = rollback('rollback-changed.txt', '.webstudio-original-changed.bak', b'current changed', b'original rollback changed')
rollback_postverify = rollback('rollback-postverify.txt', '.webstudio-original-postverify.bak', b'current postverify', b'original rollback postverify')
website_zip = work / 'website for preflight.zip'
with zipfile.ZipFile(website_zip, 'w') as archive:
    archive.writestr('index.html', b'proposed page')
def preflight():
    return subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(website_zip), str(scan_path), str(backup_path)] + ['test'] * 8, capture_output=True, text=True, timeout=75)
preflight_ok = preflight()
files['/site/index.html'] = b'Xello world!'
preflight_changed = preflight()
files['/site/index.html'] = b'Hello world!'
preflight_dialog = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(website_zip), str(scan_path), str(backup_path)] + ['test'] * 9, capture_output=True, text=True, timeout=90)
changed_input_zip = work / 'changed input website.zip'
changed_input_zip.write_bytes(website_zip.read_bytes())
preflight_changed_input = subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/site', str(changed_input_zip), str(scan_path), str(backup_path)] + ['test'] * 10, capture_output=True, text=True, timeout=30)
def ensure_folders(relative):
    return subprocess.run([str(exe), str(port), str(key_path), str(hosts_path), '/upload', relative] + ['test'] * 4, capture_output=True, text=True, timeout=75)
folders = ensure_folders('projects/site')
folders_existing = ensure_folders('projects/site')
folder_link = ensure_folders('link/child')
folder_partial = ensure_folders('partial/deny')
folder_race = ensure_folders('racedir')
thread.join(timeout=5)
print(result.stdout, result.stderr)
expected_inventory = {f'index.html:12:{hashlib.sha256(files["/site/index.html"]).hexdigest()}', f'assets/image.png:7:{hashlib.sha256(files["/site/assets/image.png"]).hexdigest()}', f'empty.txt:0:{hashlib.sha256(b"").hexdigest()}'}
expected_receipt = f'/upload/new.txt:{len(local_data)}:{hashlib.sha256(local_data).hexdigest()}'
empty_receipt = f'/upload/empty.txt:0:{hashlib.sha256(b"").hexdigest()}'
replacement_failures_ok = stale.returncode != 0 and files.get('/upload/stale.txt') == b'original stale' and race.returncode != 0 and files.get('/upload/race.txt') == b'concurrent update' and b'original race' in files.values() and changed_original.returncode != 0 and files.get('/upload/changed-original.txt') == b'Xriginal change' and postverify_replacement.returncode != 0 and b'original postverify' in files.values()
rollback_parts = rollback_ok.stdout.strip().split('|')
rollback_success = len(rollback_parts) == 4 and rollback_parts[:3] == ['/upload/update.txt', str(len(b'original update')), hashlib.sha256(b'original update').hexdigest()] and files.get('/upload/update.txt') == b'original update' and files.get(rollback_parts[3]) == local_data
rollback_failures_ok = rollback_stale.returncode != 0 and files.get('/upload/rollback-stale.txt') == b'current stale' and rollback_race.returncode != 0 and files.get('/upload/rollback-race.txt') == b'concurrent rollback' and files.get('/upload/.webstudio-original-race.bak') == b'original rollback race' and b'current race' in files.values() and rollback_changed.returncode != 0 and files.get('/upload/rollback-changed.txt') == b'Xurrent changed' and files.get('/upload/.webstudio-original-changed.bak') == b'original rollback changed' and rollback_postverify.returncode != 0 and b'current postverify' in files.values()
if result.returncode or rejected.returncode == 0 or download.returncode or existing.returncode == 0 or oversize.returncode == 0 or unsafe.returncode == 0 or inventory.returncode or links.returncode == 0 or changed.returncode == 0 or scan.returncode or scan_existing.returncode == 0 or backup.returncode or backup_existing.returncode == 0 or links_backup.returncode == 0 or collision_backup.returncode == 0 or reserved_backup.returncode == 0 or transfer.returncode or transfer.stdout.strip() != expected_receipt or collision.returncode == 0 or 'staging file may remain' not in collision.stdout or corrupt.returncode == 0 or postverify.returncode == 0 or 'inspect it before retrying' not in postverify.stdout or empty_transfer.returncode or empty_transfer.stdout.strip() != empty_receipt or replacement.returncode or not replacement_ok or not replacement_failures_ok or rollback_ok.returncode or not rollback_success or not rollback_failures_ok or preflight_ok.returncode or preflight_changed.returncode == 0 or 'destination changed' not in preflight_changed.stdout.lower() or preflight_dialog.returncode or 'Native live check passed.' not in preflight_dialog.stdout or preflight_changed_input.returncode == 0 or 'reviewed files changed' not in preflight_changed_input.stdout.lower() or folders.returncode or folders.stdout.splitlines() != ['D:/upload/projects', 'D:/upload/projects/site'] or folders_existing.returncode or folders_existing.stdout.strip() or folder_link.returncode == 0 or folder_partial.returncode == 0 or '/upload/partial' not in folder_partial.stdout or folder_race.returncode == 0 or '/upload/racedir' not in folder_race.stdout or '/upload/racedir' not in directories or '/upload/link/child' in directories or '/upload/partial/deny' in directories or files.get('/upload/new.txt') != local_data or files.get('/upload/empty.txt') != b'' or files.get('/upload/existing.txt') != b'existing user data' or '/upload/corrupt.txt' in files or links_backup_path.exists() or collision_path.exists() or reserved_path.exists() or list(work.glob('.webstudio-backup-*')) or not backup_path.exists() or backup_path.read_bytes() != backup_contents or not scan_path.exists() or scan_path.read_bytes() != scan_contents or set(inventory.stdout.splitlines()) != expected_inventory or oversize_path.exists() or unsafe_path.exists() or not destination.exists() or destination.read_bytes() != snapshot or thread.is_alive():
    print(download.stdout, download.stderr, existing.stdout, existing.stderr, inventory.stdout, inventory.stderr, scan.stdout, scan.stderr, scan_existing.stdout, scan_existing.stderr, backup.stdout, backup.stderr, links_backup.stdout, links_backup.stderr, transfer.stdout, transfer.stderr, collision.stdout, collision.stderr, corrupt.stdout, corrupt.stderr, replacement.stdout, stale.stdout, race.stdout, changed_original.stdout, postverify_replacement.stdout, rollback_ok.stdout, rollback_stale.stdout, rollback_race.stdout, rollback_changed.stdout, rollback_postverify.stdout, preflight_ok.stdout, preflight_changed.stdout, preflight_dialog.stdout, preflight_dialog.stderr, preflight_changed_input.stdout, folders.stdout, folders_existing.stdout, folder_link.stdout, folder_partial.stdout, folder_race.stdout)
    raise SystemExit('Local SFTP connection test failed')
manifest = json.loads(scan_contents)
assert manifest['format'] == 'webstudio-website-manifest' and manifest['version'] == 1
assert {f'{item["path"]}:{item["size"]}:{item["sha256"]}' for item in manifest['files']} == expected_inventory
with zipfile.ZipFile(backup_path) as archive:
    assert archive.testzip() is None
    assert 'emptydir/' in archive.namelist()
    assert {name for name in archive.namelist() if not name.endswith('/')} == {'index.html', 'assets/image.png', 'empty.txt'}
    assert archive.read('index.html') == files['/site/index.html']
    assert archive.read('assets/image.png') == files['/site/assets/image.png']
    assert archive.read('empty.txt') == b''
print('Local SFTP scan, ZIP backup and synthetic in-memory transfer checks passed. No website was published.')
