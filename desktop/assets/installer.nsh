!include LogicLib.nsh
!include WinMessages.nsh

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to PlayCrew"
  !define MUI_WELCOMEPAGE_TEXT "Install PlayCrew to keep your games, progress, screenshots, and crew together in one desktop app.$\r$\n$\r$\nSetup will preserve your existing PlayCrew data when updating."
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PlayCrewWelcomePageShow
  !insertmacro MUI_PAGE_WELCOME
!macroend

!ifndef BUILD_UNINSTALLER
Function PlayCrewWelcomePageShow
  GetDlgItem $0 $HWNDPARENT 1
  FindWindow $1 "#32770" "" $HWNDPARENT
  ReadRegStr $3 HKCU "Software\${APP_GUID}" "InstallLocation"
  ${If} $3 == ""
    ReadRegStr $3 HKLM "Software\${APP_GUID}" "InstallLocation"
  ${EndIf}

  ${If} $3 != ""
    SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Update PlayCrew"
    SendMessage $0 ${WM_SETTEXT} 0 "STR:&Update"

    GetDlgItem $2 $1 1201
    SendMessage $2 ${WM_SETTEXT} 0 "STR:Update PlayCrew"
    GetDlgItem $2 $1 1202
    SendMessage $2 ${WM_SETTEXT} 0 "STR:PlayCrew is already installed. Setup will update it to version ${VERSION} while keeping your settings and local data."
  ${Else}
    SendMessage $HWNDPARENT ${WM_SETTEXT} 0 "STR:Install PlayCrew"
    SendMessage $0 ${WM_SETTEXT} 0 "STR:&Install"
  ${EndIf}
FunctionEnd
!endif
