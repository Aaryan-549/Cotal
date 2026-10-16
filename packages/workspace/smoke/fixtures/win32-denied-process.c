#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <sddl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
  if (argc == 3 && strcmp(argv[1], "--probe") == 0) {
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, (DWORD)strtoul(argv[2], NULL, 10));
    if (process != NULL) {
      CloseHandle(process);
      fputs("readable\n", stdout);
      return 1;
    }
    if (GetLastError() != ERROR_ACCESS_DENIED) return 2;
    fputs("denied\n", stdout);
    return 0;
  }
  if (argc != 1) return 2;
  PSECURITY_DESCRIPTOR descriptor = NULL;
  // Restrict only this disposable process. The owner retains control, except query access.
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorA(
        "D:(D;;0x1000;;;WD)(A;;0x1fffff;;;OW)", SDDL_REVISION_1, &descriptor, NULL)) return 3;
  BOOL ok = SetKernelObjectSecurity(GetCurrentProcess(), DACL_SECURITY_INFORMATION, descriptor);
  LocalFree(descriptor);
  if (!ok) return 4;
  fputs("ready\n", stdout);
  fflush(stdout);
  getchar();
  return 0;
}
