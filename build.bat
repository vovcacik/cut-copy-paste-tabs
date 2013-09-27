@echo off
setlocal

for /F "usebackq tokens=3 delims=<>" %%v in (`type install.rdf ^| findstr /irc:"em:version"`) do (
    set version=%%v
)

7za a -tzip cut_copy_and_paste_tabs-%version%-fx.xpi @build.list
exit /B 0
