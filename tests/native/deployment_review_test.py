import hashlib, json, os, pathlib, subprocess, uuid, zipfile

# Run after sftp_loopback_test.py, with WEBSTUDIO_SFTP_FIXTURE set to its folder.
fixture = pathlib.Path(os.environ['WEBSTUDIO_SFTP_FIXTURE'])
root = pathlib.Path(__file__).resolve().parents[2]
exe = root / 'test-results' / 'm6-sftp-build' / 'SftpConnectionSmoke.exe'
work = root / 'test-results' / ('m6-native-review-' + uuid.uuid4().hex)
work.mkdir()
backup = fixture / 'destination backup.zip'
scan = fixture / 'live destination scan.json'
desired = work / 'website.zip'
with zipfile.ZipFile(desired, 'w', compression=zipfile.ZIP_STORED) as archive:
    archive.writestr('index.html', b'updated page')
    archive.writestr('new.txt', b'new content')
    archive.writestr('empty.txt', b'')

def review(site, scan_file, backup_file):
    return subprocess.run([str(exe), str(site), str(scan_file), str(backup_file)] + ['test'] * 9, capture_output=True, text=True, timeout=30)

result = review(desired, scan, backup)
expected = {'A:new.txt', 'C:index.html', 'R:assets/image.png',
            'T:new.txt|0|11|' + hashlib.sha256(b'new content').hexdigest() + '|0|',
            'T:index.html|1|12|' + hashlib.sha256(b'updated page').hexdigest() + '|12|' + hashlib.sha256(b'Hello world!').hexdigest(),
            'W:' + hashlib.sha256(desired.read_bytes()).hexdigest(),
            'S:' + hashlib.sha256(scan.read_bytes()).hexdigest(),
            'B:' + hashlib.sha256(backup.read_bytes()).hexdigest()}
if result.returncode or set(result.stdout.splitlines()) != expected:
    raise SystemExit('Native review failed: ' + result.stdout + result.stderr)
dialog = subprocess.run([str(exe), str(desired), str(scan), str(backup)] + ['test'] * 10, capture_output=True, text=True, timeout=40)
if dialog.returncode or 'Native review dialog passed.' not in dialog.stdout:
    raise SystemExit('Native review dialog failed: ' + dialog.stdout + dialog.stderr)

journal = work / 'transfer receipt.jsonl'
failed_journal = work / 'failed transfer receipt.jsonl'
journal_result = subprocess.run([str(exe), str(desired), str(scan), str(backup), str(journal), str(failed_journal)] + ['test'] * 13, capture_output=True, text=True, timeout=30)
if journal_result.returncode or 'Journal checks passed.' not in journal_result.stdout:
    raise SystemExit('Native journal test failed: ' + journal_result.stdout + journal_result.stderr)
records = [json.loads(line) for line in journal.read_text(encoding='utf8').splitlines()]
assert [record['event'] for record in records] == ['reviewed', 'transfer-started', 'transfer-verified', 'transfer-started', 'transfer-verified', 'complete']
assert records[0]['onlyAtDestination'] == ['assets/image.png']
assert records[1]['stagedPath'] == '/site/.webstudio-upload-{11111111-1111-1111-1111-111111111111}.tmp'
assert records[3]['originalPath'] == '/site/.webstudio-original-{22222222-2222-2222-2222-222222222222}.bak'
assert [json.loads(line)['event'] for line in failed_journal.read_text(encoding='utf8').splitlines()] == ['reviewed', 'transfer-started', 'transfer-failed']

changed_input = work / 'website changed after review.zip'
changed_input.write_bytes(desired.read_bytes())
changed_result = subprocess.run([str(exe), '1', 'unused-key', 'unused-hosts', '/site', str(changed_input), str(scan), str(backup)] + ['test'] * 10, capture_output=True, text=True, timeout=30)
assert changed_result.returncode != 0 and 'reviewed files changed' in changed_result.stdout.lower()

bad_scan = work / 'bad-scan.json'
data = json.loads(scan.read_text(encoding='utf8'))
data['files'][0]['sha256'] = '0' * 64
bad_scan.write_text(json.dumps(data), encoding='utf8')
assert review(desired, bad_scan, backup).returncode != 0

bad_zip = work / 'corrupt.zip'
corrupted = bytearray(desired.read_bytes())
offset = corrupted.index(b'updated page')
corrupted[offset] ^= 1
bad_zip.write_bytes(corrupted)
assert review(bad_zip, scan, backup).returncode != 0

unsafe = work / 'unsafe.zip'
with zipfile.ZipFile(unsafe, 'w') as archive:
    archive.writestr('../outside.txt', b'unsafe')
assert review(unsafe, scan, backup).returncode != 0

collision = work / 'collision.zip'
with zipfile.ZipFile(collision, 'w') as archive:
    archive.writestr('Page.html', b'one')
    archive.writestr('page.html', b'two')
assert review(collision, scan, backup).returncode != 0

conflict = work / 'conflict.zip'
with zipfile.ZipFile(conflict, 'w') as archive:
    archive.writestr('folder/file.txt', b'one')
    archive.writestr('folder', b'two')
assert review(conflict, scan, backup).returncode != 0
print('Native review matched the local SFTP fixture and rejected stale, corrupt, unsafe and conflicting inputs.')
