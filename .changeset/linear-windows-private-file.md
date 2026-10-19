---
"@cotal-ai/linear": patch
---

A Linear token or OAuth state file on Windows is no longer refused as "readable by other users (mode 666)". Windows reports every file's POSIX mode as 666, so the check refused every token-mode account there, including token files Cotal wrote itself. The mode check now applies only where POSIX modes exist, as for the broker TLS key and launch material; on Windows the file's privacy is the ACL Cotal sets when it writes the file.
