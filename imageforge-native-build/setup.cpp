#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <shellapi.h>
#include <wrl/client.h>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

static const wchar_t* APP_NAME=L"ImageForge AI Studio Native";
static const wchar_t* APP_EXE=L"ImageForgeAI.exe";
static const wchar_t* UNINSTALL_EXE=L"Uninstall.exe";
static const wchar_t* UNINSTALL_KEY=L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ImageForgeAI-Native";

static std::wstring known(REFKNOWNFOLDERID id){
    PWSTR p=nullptr; std::wstring out;
    if(SUCCEEDED(SHGetKnownFolderPath(id,KF_FLAG_CREATE,nullptr,&p))&&p){out=p;CoTaskMemFree(p);}
    return out;
}
static bool ensureDir(const std::wstring& p){
    if(CreateDirectoryW(p.c_str(),nullptr)||GetLastError()==ERROR_ALREADY_EXISTS)return true;
    return false;
}
static std::wstring installDir(){
    auto p=known(FOLDERID_LocalAppData);
    return p+L"\\Programs\\ImageForge AI Studio";
}
static bool writeEmbedded(const std::wstring& out){
    HRSRC r=FindResourceW(nullptr,MAKEINTRESOURCEW(101),RT_RCDATA); if(!r)return false;
    HGLOBAL h=LoadResource(nullptr,r); if(!h)return false;
    DWORD sz=SizeofResource(nullptr,r); const void* data=LockResource(h); if(!data||!sz)return false;
    HANDLE f=CreateFileW(out.c_str(),GENERIC_WRITE,0,nullptr,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,nullptr); if(f==INVALID_HANDLE_VALUE)return false;
    DWORD wrote=0; BOOL ok=WriteFile(f,data,sz,&wrote,nullptr); CloseHandle(f); return ok&&wrote==sz;
}
static bool copySelf(const std::wstring& out){
    wchar_t self[MAX_PATH]; GetModuleFileNameW(nullptr,self,MAX_PATH);
    return CopyFileW(self,out.c_str(),FALSE)!=0;
}
static bool shortcut(const std::wstring& link,const std::wstring& target,const std::wstring& desc){
    ComPtr<IShellLinkW> sl; if(FAILED(CoCreateInstance(CLSID_ShellLink,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&sl))))return false;
    sl->SetPath(target.c_str()); sl->SetDescription(desc.c_str()); sl->SetWorkingDirectory(installDir().c_str());
    ComPtr<IPersistFile> pf; if(FAILED(sl.As(&pf)))return false; return SUCCEEDED(pf->Save(link.c_str(),TRUE));
}
static void writeUninstallRegistry(const std::wstring& dir){
    HKEY k{}; if(RegCreateKeyExW(HKEY_CURRENT_USER,UNINSTALL_KEY,0,nullptr,0,KEY_WRITE,nullptr,&k,nullptr)!=ERROR_SUCCESS)return;
    auto set=[&](const wchar_t*n,const std::wstring&v){RegSetValueExW(k,n,0,REG_SZ,(const BYTE*)v.c_str(),(DWORD)((v.size()+1)*sizeof(wchar_t)));};
    set(L"DisplayName",APP_NAME); set(L"DisplayVersion",L"1.1.2"); set(L"Publisher",L"ImageForge AI");
    set(L"InstallLocation",dir); set(L"DisplayIcon",dir+L"\\"+APP_EXE);
    set(L"UninstallString",L"\""+dir+L"\\"+UNINSTALL_EXE+L"\" /uninstall");
    DWORD one=1; RegSetValueExW(k,L"NoModify",0,REG_DWORD,(BYTE*)&one,sizeof(one));RegSetValueExW(k,L"NoRepair",0,REG_DWORD,(BYTE*)&one,sizeof(one));
    RegCloseKey(k);
}
static void removeShortcutPaths(){
    auto desk=known(FOLDERID_Desktop); if(!desk.empty())DeleteFileW((desk+L"\\ImageForge AI Studio.lnk").c_str());
    auto menu=known(FOLDERID_Programs); if(!menu.empty())DeleteFileW((menu+L"\\ImageForge AI Studio.lnk").c_str());
}
static bool hasArg(const wchar_t* a){
    int argc=0; LPWSTR* argv=CommandLineToArgvW(GetCommandLineW(),&argc); bool found=false;
    if(argv){for(int i=1;i<argc;++i)if(_wcsicmp(argv[i],a)==0){found=true;break;}LocalFree(argv);}return found;
}
static int uninstall(){
    std::wstring dir=installDir(); removeShortcutPaths(); DeleteFileW((dir+L"\\"+APP_EXE).c_str());
    RegDeleteTreeW(HKEY_CURRENT_USER,UNINSTALL_KEY);
    wchar_t self[MAX_PATH];GetModuleFileNameW(nullptr,self,MAX_PATH);
    std::wstring cmd=L"/C timeout /t 2 /nobreak >nul & del /f /q \""+std::wstring(self)+L"\" & rmdir /q \""+dir+L"\"";
    ShellExecuteW(nullptr,L"open",L"cmd.exe",cmd.c_str(),nullptr,SW_HIDE);
    MessageBoxW(nullptr,L"ImageForge AI Studio foi removido.",L"Desinstalação",MB_OK|MB_ICONINFORMATION);
    return 0;
}
int WINAPI wWinMain(HINSTANCE,HINSTANCE,PWSTR,int){
    CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    if(hasArg(L"/uninstall")){int r=uninstall();CoUninitialize();return r;}
    if(MessageBoxW(nullptr,L"Instalar ImageForge AI Studio Native 1.1.2 (Win64) neste usuário?",L"ImageForge AI Studio — Instalação",MB_YESNO|MB_ICONQUESTION)!=IDYES){CoUninitialize();return 0;}
    std::wstring dir=installDir(); std::wstring parent=known(FOLDERID_LocalAppData)+L"\\Programs";
    ensureDir(parent); if(!ensureDir(dir)){MessageBoxW(nullptr,L"Não foi possível criar a pasta de instalação.",L"Erro",MB_OK|MB_ICONERROR);CoUninitialize();return 1;}
    std::wstring app=dir+L"\\"+APP_EXE; if(!writeEmbedded(app)){MessageBoxW(nullptr,L"Falha ao extrair o aplicativo embutido.",L"Erro",MB_OK|MB_ICONERROR);CoUninitialize();return 2;}
    std::wstring un=dir+L"\\"+UNINSTALL_EXE; copySelf(un);
    auto desk=known(FOLDERID_Desktop); if(!desk.empty())shortcut(desk+L"\\ImageForge AI Studio.lnk",app,L"ImageForge AI Studio Native");
    auto menu=known(FOLDERID_Programs); if(!menu.empty())shortcut(menu+L"\\ImageForge AI Studio.lnk",app,L"ImageForge AI Studio Native");
    writeUninstallRegistry(dir);
    if(MessageBoxW(nullptr,L"Instalação concluída com sucesso.\n\nAbrir o ImageForge AI Studio agora?",L"ImageForge AI Studio",MB_YESNO|MB_ICONINFORMATION)==IDYES)ShellExecuteW(nullptr,L"open",app.c_str(),nullptr,dir.c_str(),SW_SHOWNORMAL);
    CoUninitialize();return 0;
}
