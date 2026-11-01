import getpass, hashlib, io, json, os, pathlib, socket, stat, subprocess, sys, threading, uuid, zipfile

# Synthetic files live only in this loopback server's memory. No website is published.
root = pathlib.Path(__file__).resolve().parents[2]
base = root / 'test-results'
sys.path.insert(0, str(base / 'm6-sftp-server-deps'))
import paramiko

work = base / ('m6-executor-' + uuid.uuid4().hex)
work.mkdir()
host_key = paramiko.RSAKey.generate(2048)
user_key = paramiko.RSAKey.generate(2048)
key = work / 'client_key'
user_key.write_private_key_file(str(key))
subprocess.run(['icacls', str(key), '/inheritance:r', '/grant:r', getpass.getuser() + ':(R,W)'], check=True, capture_output=True)
listener = socket.socket()
listener.bind(('127.0.0.1', 0))
listener.listen(1)
listener.settimeout(60)
port = listener.getsockname()[1]
hosts = work / 'known_hosts'
hosts.write_text(f'[127.0.0.1]:{port} {host_key.get_name()} {host_key.get_base64()}\n', encoding='ascii')

baseline = {'index.html': b'Hello world!', 'assets/image.png': b'picture', 'empty.txt': b''}
roots = ['/success', '/stale', '/race', '/journal', '/deny', '/midfail', '/postchange']
files = {prefix + '/' + name: content for prefix in roots for name, content in baseline.items()}
directories = {directory for prefix in roots for directory in [prefix, prefix + '/assets']}
removed = []
class Writer(paramiko.SFTPHandle):
    def __init__(self, path, flags):
        super().__init__(flags)
        self.path = path
    def write(self, offset, data):
        if offset != len(files[self.path]):
            return paramiko.SFTP_FAILURE
        files[self.path] += data
        return paramiko.SFTP_OK

class Server(paramiko.ServerInterface):
    def check_auth_publickey(self, username, value):
        return paramiko.AUTH_SUCCESSFUL if username == 'testuser' and value == user_key else paramiko.AUTH_FAILED
    def get_allowed_auths(self, username):
        return 'publickey'
    def check_channel_request(self, kind, channel_id):
        return paramiko.OPEN_SUCCEEDED if kind == 'session' else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

class Files(paramiko.SFTPServerInterface):
    def lstat(self, path):
        return self.stat(path)
    def stat(self, path):
        path = path.rstrip('/') or '/'
        entry = paramiko.SFTPAttributes()
        if path in directories:
            entry.st_mode, entry.st_size = stat.S_IFDIR | 0o755, 0
        elif path in files:
            entry.st_mode, entry.st_size = stat.S_IFREG | 0o644, len(files[path])
        else:
            return paramiko.SFTP_NO_SUCH_FILE
        return entry
    def list_folder(self, path):
        path = path.rstrip('/') or '/'
        if path not in directories:
            return paramiko.SFTP_NO_SUCH_FILE
        prefix = path + '/'
        entries = []
        for candidate in sorted(directories | set(files)):
            if candidate.startswith(prefix) and '/' not in candidate[len(prefix):]:
                entry = self.stat(candidate)
                entry.filename = candidate[len(prefix):]
                entries.append(entry)
        return entries
    def open(self, path, flags, attr):
        if '/.webstudio-upload-' in path and flags & os.O_CREAT:
            if path in files or path.rsplit('/', 1)[0] not in directories:
                return paramiko.SFTP_FAILURE
            files[path] = b''
            return Writer(path, flags)
        if path not in files or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC):
            return paramiko.SFTP_PERMISSION_DENIED
        handle = paramiko.SFTPHandle(flags)
        handle.readfile = io.BytesIO(files[path])
        return handle
    def mkdir(self, path, attr):
        if path == '/deny/newfolder':
            return paramiko.SFTP_PERMISSION_DENIED
        if path in directories or path in files or path.rsplit('/', 1)[0] not in directories:
            return paramiko.SFTP_FAILURE
        directories.add(path)
        if path == '/race/newfolder':
            files[path + '/new.txt'] = b'concurrent user data'
        return paramiko.SFTP_OK
    def rename(self, oldpath, newpath):
        if oldpath not in files or newpath in files:
            return paramiko.SFTP_FAILURE
        files[newpath] = files.pop(oldpath)
        if newpath == '/midfail/newfolder/new.txt':
            directories.add('/midfail/secondfolder')
            files['/midfail/secondfolder/second.txt'] = b'concurrent user data'
        if newpath == '/postchange/secondfolder/second.txt' and '/.webstudio-upload-' in oldpath:
            files['/postchange/assets/image.png'] = b'PicturE'
        return paramiko.SFTP_OK
    def remove(self, path):
        removed.append(path)
        return paramiko.SFTP_PERMISSION_DENIED

errors = []
def serve():
    try:
        for _ in range(24):
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
    except Exception as exc:
        errors.append(str(exc))
    finally:
        listener.close()

thread = threading.Thread(target=serve, daemon=True)
thread.start()
scan = work / 'scan.json'
scan.write_text(json.dumps({'format': 'webstudio-website-manifest', 'version': 1, 'files': [
    {'path': name, 'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
    for name, content in baseline.items()]}), encoding='utf8')
backup = work / 'backup.zip'
with zipfile.ZipFile(backup, 'w') as archive:
    for name, content in baseline.items():
        archive.writestr(name, content)
website = work / 'proposed.zip'
with zipfile.ZipFile(website, 'w') as archive:
    archive.writestr('index.html', b'Hello world!')
    archive.writestr('empty.txt', b'')
    archive.writestr('newfolder/new.txt', b'synthetic addition')
    archive.writestr('secondfolder/second.txt', b'second addition')
exe = base / 'm6-sftp-build' / 'SftpConnectionSmoke.exe'

def execute(remote, journal, confirmed='confirmed', source=website, extra=11):
    return subprocess.run([str(exe), str(port), str(key), str(hosts), remote, str(source), str(scan), str(backup), str(journal), confirmed] + ['test'] * extra, capture_output=True, text=True, timeout=90)

not_confirmed_path = work / 'not-confirmed.jsonl'
not_confirmed = execute('/success', not_confirmed_path, 'no')
assert not_confirmed.returncode != 0 and not not_confirmed_path.exists()
success_path = work / 'success.jsonl'
success = execute('/success', success_path)
if success.returncode:
    raise SystemExit('Synthetic execution failed: ' + success.stdout + success.stderr)
assert success.stdout.strip() == 'Transfers:2|Preserved:1'
records = [json.loads(line) for line in success_path.read_text(encoding='utf8').splitlines()]
assert [record['event'] for record in records] == ['reviewed', 'directory-intent', 'transfer-started', 'transfer-verified', 'directory-intent', 'transfer-started', 'transfer-verified', 'destination-verified', 'complete']
assert records[0]['onlyAtDestination'] == ['assets/image.png']
assert files['/success/index.html'] == b'Hello world!'
assert files['/success/newfolder/new.txt'] == b'synthetic addition'
assert files['/success/secondfolder/second.txt'] == b'second addition'
assert files['/success/assets/image.png'] == b'picture'

replacement_website = work / 'replacement.zip'
with zipfile.ZipFile(replacement_website, 'w') as archive:
    archive.writestr('index.html', b'replacement')
replacement_journal = work / 'replacement.jsonl'
replacement = execute('/success', replacement_journal, source=replacement_website)
assert replacement.returncode != 0 and 'private recovery storage' in replacement.stdout.lower() and not replacement_journal.exists()

files['/stale/index.html'] = b'Xello world!'
stale_path = work / 'stale.jsonl'
stale = execute('/stale', stale_path)
assert stale.returncode != 0 and not stale_path.exists() and files['/stale/index.html'] == b'Xello world!'

race_path = work / 'race.jsonl'
race = execute('/race', race_path)
assert race.returncode != 0 and race_path.exists()
race_records = [json.loads(line) for line in race_path.read_text(encoding='utf8').splitlines()]
assert [record['event'] for record in race_records] == ['reviewed', 'directory-intent', 'transfer-started', 'transfer-failed']
assert files['/race/newfolder/new.txt'] == b'concurrent user data' and files['/race/index.html'] == b'Hello world!'
assert race_records[2]['stagedPath'] in files

existing_path = work / 'existing.jsonl'
existing_path.write_bytes(b'keep existing receipt')
existing = execute('/journal', existing_path)
assert existing.returncode != 0 and existing_path.read_bytes() == b'keep existing receipt' and files['/journal/index.html'] == b'Hello world!'

denied_path = work / 'denied.jsonl'
denied = execute('/deny', denied_path)
assert denied.returncode != 0 and denied_path.exists() and '/deny/newfolder' not in directories
assert [json.loads(line)['event'] for line in denied_path.read_text(encoding='utf8').splitlines()] == ['reviewed', 'directory-intent', 'stopped']

midfail_path = work / 'midfail.jsonl'
midfail = execute('/midfail', midfail_path)
assert midfail.returncode != 0 and midfail_path.exists()
assert [json.loads(line)['event'] for line in midfail_path.read_text(encoding='utf8').splitlines()] == ['reviewed', 'directory-intent', 'transfer-started', 'transfer-verified', 'directory-intent', 'transfer-started', 'transfer-failed']
assert files['/midfail/index.html'] == b'Hello world!' and files['/midfail/newfolder/new.txt'] == b'synthetic addition' and files['/midfail/secondfolder/second.txt'] == b'concurrent user data'

postchange_path = work / 'postchange.jsonl'
postchange = execute('/postchange', postchange_path)
assert postchange.returncode != 0 and postchange_path.exists()
assert [json.loads(line)['event'] for line in postchange_path.read_text(encoding='utf8').splitlines()] == ['reviewed', 'directory-intent', 'transfer-started', 'transfer-verified', 'directory-intent', 'transfer-started', 'transfer-verified', 'stopped']
assert files['/postchange/assets/image.png'] == b'PicturE'

changed_website = work / 'changed.zip'
changed_website.write_bytes(website.read_bytes())
changed_path = work / 'changed.jsonl'
changed = execute('/stale', changed_path, source=changed_website, extra=12)
assert changed.returncode != 0 and not changed_path.exists(), (changed.returncode, changed.stdout, changed.stderr, changed_path.exists())
thread.join(timeout=5)
assert not thread.is_alive() and not errors and not removed
print('Synthetic site transfer, receipts and failure handling passed; no website was published.')
