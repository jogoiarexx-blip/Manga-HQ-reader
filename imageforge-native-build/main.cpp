#define UNICODE
#define _UNICODE
#define NOMINMAX
#include <windows.h>
#include <wincodec.h>
#include <shobjidl.h>
#include <wrl/client.h>
#include <dwmapi.h>
#include <vector>
#include <string>
#include <memory>
#include <algorithm>
#include <cmath>
#include <array>
#include <stdexcept>
#include <cstdint>

#pragma comment(lib,"windowscodecs.lib")
#pragma comment(lib,"ole32.lib")
#pragma comment(lib,"shell32.lib")
#pragma comment(lib,"dwmapi.lib")

using Microsoft::WRL::ComPtr;

namespace iforge {

struct Pixel { std::uint8_t b{},g{},r{},a{255}; };

struct Image {
    int w{},h{};
    std::vector<Pixel> px;
    Image()=default;
    Image(int W,int H,Pixel fill={}):w(W),h(H),px((size_t)W*H,fill){}
    bool empty() const { return w<=0||h<=0||px.empty(); }
    Pixel& at(int x,int y){ return px[(size_t)y*w+x]; }
    const Pixel& at(int x,int y) const { return px[(size_t)y*w+x]; }
};

enum class Blend { Normal, Multiply, Screen, Overlay, Difference };
struct Layer {
    std::wstring name=L"Layer";
    Image img;
    bool visible=true;
    float opacity=1.f;
    Blend blend=Blend::Normal;
};

static std::uint8_t u8(float v){ return (std::uint8_t)std::clamp(v,0.f,255.f); }

static Pixel blendPixel(Pixel b, Pixel t, Blend mode, float op){
    float a=(t.a/255.f)*std::clamp(op,0.f,1.f);
    auto ch=[&](int B,int T){
        float v=T;
        switch(mode){
            case Blend::Multiply: v=B*T/255.f; break;
            case Blend::Screen: v=255.f-(255.f-B)*(255.f-T)/255.f; break;
            case Blend::Overlay: v=B<128?2.f*B*T/255.f:255.f-2.f*(255.f-B)*(255.f-T)/255.f; break;
            case Blend::Difference: v=std::abs(B-T); break;
            default: break;
        }
        return u8(B*(1.f-a)+v*a);
    };
    return {ch(b.b,t.b),ch(b.g,t.g),ch(b.r,t.r),255};
}

class Document {
public:
    std::vector<Layer> layers;
    size_t active=0;
    std::vector<std::vector<Layer>> undo,redo;
    int w{},h{};
    explicit Document(Image base){w=base.w;h=base.h;layers.push_back({L"Background",std::move(base),true,1.f,Blend::Normal});}
    void snapshot(){undo.push_back(layers); if(undo.size()>10)undo.erase(undo.begin()); redo.clear();}
    bool doUndo(){if(undo.empty())return false;redo.push_back(layers);layers=undo.back();undo.pop_back();active=std::min(active,layers.size()-1);return true;}
    bool doRedo(){if(redo.empty())return false;undo.push_back(layers);layers=redo.back();redo.pop_back();active=std::min(active,layers.size()-1);return true;}
    Image composite() const{
        Image out(w,h,{0,0,0,255});
        for(const auto& l:layers){
            if(!l.visible) continue;
            for(size_t i=0;i<out.px.size() && i<l.img.px.size();++i) out.px[i]=blendPixel(out.px[i],l.img.px[i],l.blend,l.opacity);
        }
        return out;
    }
    Layer& current(){return layers[active];}
    void add(){snapshot();layers.push_back({L"New Layer",Image(w,h,{0,0,0,0}),true,1.f,Blend::Normal});active=layers.size()-1;}
    void duplicate(){snapshot();layers.push_back(layers[active]);layers.back().name+=L" copy";active=layers.size()-1;}
    void del(){if(layers.size()<=1)return;snapshot();layers.erase(layers.begin()+active);active=std::min(active,layers.size()-1);}
    void flatten(){snapshot();Image c=composite();layers.clear();layers.push_back({L"Flattened",std::move(c),true,1.f,Blend::Normal});active=0;}
};

static Image brightness(const Image&s,float d){Image o=s;for(auto&p:o.px){p.b=u8(p.b+d);p.g=u8(p.g+d);p.r=u8(p.r+d);}return o;}
static Image contrast(const Image&s,float f){Image o=s;for(auto&p:o.px){p.b=u8((p.b-127.5f)*f+127.5f);p.g=u8((p.g-127.5f)*f+127.5f);p.r=u8((p.r-127.5f)*f+127.5f);}return o;}
static Image saturation(const Image&s,float f){Image o=s;for(auto&p:o.px){float l=.114f*p.b+.587f*p.g+.299f*p.r;p.b=u8(l+(p.b-l)*f);p.g=u8(l+(p.g-l)*f);p.r=u8(l+(p.r-l)*f);}return o;}
static Image grayscale(const Image&s){Image o=s;for(auto&p:o.px){auto y=u8(.114f*p.b+.587f*p.g+.299f*p.r);p.b=p.g=p.r=y;}return o;}
static Image invert(const Image&s){Image o=s;for(auto&p:o.px){p.b=255-p.b;p.g=255-p.g;p.r=255-p.r;}return o;}
static Image blur(const Image&s,int r){
    if(r<=0||s.empty())return s; Image o(s.w,s.h);
    for(int y=0;y<s.h;++y)for(int x=0;x<s.w;++x){int sb=0,sg=0,sr=0,sa=0,n=0;
        for(int yy=std::max(0,y-r);yy<=std::min(s.h-1,y+r);++yy)for(int xx=std::max(0,x-r);xx<=std::min(s.w-1,x+r);++xx){auto p=s.at(xx,yy);sb+=p.b;sg+=p.g;sr+=p.r;sa+=p.a;++n;}
        o.at(x,y)={(std::uint8_t)(sb/n),(std::uint8_t)(sg/n),(std::uint8_t)(sr/n),(std::uint8_t)(sa/n)};
    } return o;
}
static Image sharpen(const Image&s,float a){auto b=blur(s,1);Image o=s;for(size_t i=0;i<o.px.size();++i){auto q=b.px[i],p=s.px[i];o.px[i].b=u8(p.b+(p.b-q.b)*a);o.px[i].g=u8(p.g+(p.g-q.g)*a);o.px[i].r=u8(p.r+(p.r-q.r)*a);}return o;}
static Image shadowsHighlights(const Image&s,float sh,float hi){
    Image o=s;
    for(auto&p:o.px){float l=(.114f*p.b+.587f*p.g+.299f*p.r)/255.f;float gain=1.f+sh*(1.f-l)*(1.f-l)-hi*l*l*.55f;p.b=u8(p.b*gain);p.g=u8(p.g*gain);p.r=u8(p.r*gain);}return o;
}
static Image reduceBloom(const Image&s,float a){
    auto b=blur(s,4);Image o=s;
    for(size_t i=0;i<o.px.size();++i){float lum=(s.px[i].r+s.px[i].g+s.px[i].b)/765.f;float m=std::clamp((lum-.68f)/.32f,0.f,1.f)*a; o.px[i].b=u8(s.px[i].b-(b.px[i].b-s.px[i].b)*m*.65f);o.px[i].g=u8(s.px[i].g-(b.px[i].g-s.px[i].g)*m*.65f);o.px[i].r=u8(s.px[i].r-(b.px[i].r-s.px[i].r)*m*.65f);}
    return o;
}
static Image flare(const Image&s,float a){
    Image o=s;auto broad=blur(s,9);
    for(size_t i=0;i<o.px.size();++i){float mx=std::max({s.px[i].r,s.px[i].g,s.px[i].b})/255.f;float m=std::clamp((mx-.72f)/.28f,0.f,1.f)*a;o.px[i].b=u8(s.px[i].b*(1-m*.22f)+broad.px[i].b*m*.08f);o.px[i].g=u8(s.px[i].g*(1-m*.22f)+broad.px[i].g*m*.08f);o.px[i].r=u8(s.px[i].r*(1-m*.22f)+broad.px[i].r*m*.08f);}return o;
}

static void check(HRESULT hr,const char* m){if(FAILED(hr))throw std::runtime_error(m);}
static Image loadWic(const std::wstring& path){
    ComPtr<IWICImagingFactory> f;check(CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&f)),"factory");
    ComPtr<IWICBitmapDecoder>d;check(f->CreateDecoderFromFilename(path.c_str(),nullptr,GENERIC_READ,WICDecodeMetadataCacheOnLoad,&d),"decode");
    ComPtr<IWICBitmapFrameDecode> fr;check(d->GetFrame(0,&fr),"frame");UINT w=0,h=0;check(fr->GetSize(&w,&h),"size");
    ComPtr<IWICFormatConverter> c;check(f->CreateFormatConverter(&c),"convert");check(c->Initialize(fr.Get(),GUID_WICPixelFormat32bppBGRA,WICBitmapDitherTypeNone,nullptr,0,WICBitmapPaletteTypeCustom),"init");
    Image img((int)w,(int)h);check(c->CopyPixels(nullptr,w*4,w*h*4,(BYTE*)img.px.data()),"copy");return img;
}
static GUID formatFromPath(const std::wstring&p){
    auto dot=p.find_last_of(L'.');std::wstring e=dot==std::wstring::npos?L"":p.substr(dot);
    std::transform(e.begin(),e.end(),e.begin(),::towlower);
    if(e==L".jpg"||e==L".jpeg")return GUID_ContainerFormatJpeg;
    if(e==L".bmp")return GUID_ContainerFormatBmp;
    if(e==L".tif"||e==L".tiff")return GUID_ContainerFormatTiff;
    return GUID_ContainerFormatPng;
}
static void saveWic(const std::wstring& path,const Image&img){
    ComPtr<IWICImagingFactory> f;check(CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&f)),"factory");
    ComPtr<IWICStream>s;check(f->CreateStream(&s),"stream");check(s->InitializeFromFilename(path.c_str(),GENERIC_WRITE),"streaminit");
    GUID cont=formatFromPath(path);ComPtr<IWICBitmapEncoder> e;check(f->CreateEncoder(cont,nullptr,&e),"encoder");check(e->Initialize(s.Get(),WICBitmapEncoderNoCache),"encinit");
    ComPtr<IWICBitmapFrameEncode> fr;ComPtr<IPropertyBag2> props;check(e->CreateNewFrame(&fr,&props),"newframe");check(fr->Initialize(props.Get()),"frinit");check(fr->SetSize(img.w,img.h),"setsize");
    WICPixelFormatGUID fmt=(cont==GUID_ContainerFormatJpeg)?GUID_WICPixelFormat24bppBGR:GUID_WICPixelFormat32bppBGRA;check(fr->SetPixelFormat(&fmt),"pixfmt");
    if(fmt==GUID_WICPixelFormat32bppBGRA){check(fr->WritePixels(img.h,img.w*4,img.w*img.h*4,(BYTE*)img.px.data()),"write");}
    else{std::vector<BYTE>bgr((size_t)img.w*img.h*3);for(size_t i=0;i<img.px.size();++i){bgr[i*3]=img.px[i].b;bgr[i*3+1]=img.px[i].g;bgr[i*3+2]=img.px[i].r;}check(fr->WritePixels(img.h,img.w*3,(UINT)bgr.size(),bgr.data()),"writejpg");}
    check(fr->Commit(),"frcommit");check(e->Commit(),"commit");
}

enum : UINT {
 ID_OPEN=1001,ID_SAVE,ID_SAVEAS,ID_EXIT,
 ID_UNDO=1101,ID_REDO,
 ID_BRIGHT=1201,ID_DARK,ID_CONTRAST,ID_SAT,ID_GRAY,ID_INVERT,ID_SHARP,ID_BLUR,ID_HIGHLIGHTS,ID_BLOOM,ID_FLARE,
 ID_LAYER_NEW=1301,ID_LAYER_DUP,ID_LAYER_DEL,ID_LAYER_FLAT,
 ID_FIT=1401,ID_100,ID_ABOUT=1501
};

class App {
    HINSTANCE inst{}; HWND hwnd{}; std::unique_ptr<Document> doc; std::wstring file; bool fit=true;
    static LRESULT CALLBACK Proc(HWND h,UINT m,WPARAM w,LPARAM l){
        App*self=(App*)GetWindowLongPtrW(h,GWLP_USERDATA);
        if(m==WM_NCCREATE){self=(App*)((CREATESTRUCTW*)l)->lpCreateParams;SetWindowLongPtrW(h,GWLP_USERDATA,(LONG_PTR)self);}
        return self?self->handle(h,m,w,l):DefWindowProcW(h,m,w,l);
    }
    static HMENU pop(std::initializer_list<std::pair<UINT,const wchar_t*>> a){HMENU m=CreatePopupMenu();for(auto [id,t]:a) id?AppendMenuW(m,MF_STRING,id,t):AppendMenuW(m,MF_SEPARATOR,0,nullptr);return m;}
    void menus(){
        HMENU bar=CreateMenu();
        AppendMenuW(bar,MF_POPUP,(UINT_PTR)pop({{ID_OPEN,L"&Abrir...\tCtrl+O"},{ID_SAVE,L"&Salvar\tCtrl+S"},{ID_SAVEAS,L"Salvar &como..."},{0,L""},{ID_EXIT,L"Sai&r"}}),L"&Arquivo");
        AppendMenuW(bar,MF_POPUP,(UINT_PTR)pop({{ID_UNDO,L"&Desfazer\tCtrl+Z"},{ID_REDO,L"&Refazer\tCtrl+Y"}}),L"&Editar");
        AppendMenuW(bar,MF_POPUP,(UINT_PTR)pop({{ID_BRIGHT,L"Aumentar brilho"},{ID_DARK,L"Reduzir brilho"},{ID_CONTRAST,L"Mais contraste"},{ID_SAT,L"Mais saturação"},{0,L""},{ID_GRAY,L"Preto e branco"},{ID_INVERT,L"Inverter"},{ID_SHARP,L"Nitidez"},{ID_BLUR,L"Desfoque"},{0,L""},{ID_HIGHLIGHTS,L"Recuperar luzes/sombras"},{ID_BLOOM,L"Reduzir bloom"},{ID_FLARE,L"Remover flare agressivo"}}),L"&Imagem");
        AppendMenuW(bar,MF_POPUP,(UINT_PTR)pop({{ID_LAYER_NEW,L"Nova camada"},{ID_LAYER_DUP,L"Duplicar camada"},{ID_LAYER_DEL,L"Excluir camada"},{ID_LAYER_FLAT,L"Mesclar tudo"}}),L"&Camadas");
        AppendMenuW(bar,MF_POPUP,(UINT_PTR)pop({{ID_FIT,L"Ajustar à janela"},{ID_100,L"100%"}}),L"E&xibir");
        AppendMenuW(bar,MF_POPUP,(UINT_PTR)pop({{ID_ABOUT,L"Sobre"}}),L"A&juda");SetMenu(hwnd,bar);
    }
    std::wstring pick(bool save){
        ComPtr<IFileDialog>d;if(save){ComPtr<IFileSaveDialog>x;if(FAILED(CoCreateInstance(CLSID_FileSaveDialog,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&x))))return{};d=x;}else{ComPtr<IFileOpenDialog>x;if(FAILED(CoCreateInstance(CLSID_FileOpenDialog,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&x))))return{};d=x;}
        COMDLG_FILTERSPEC fs[]={{L"Imagens",L"*.png;*.jpg;*.jpeg;*.bmp;*.tif;*.tiff"},{L"Todos",L"*.*"}};d->SetFileTypes(2,fs);
        if(FAILED(d->Show(hwnd)))return{};ComPtr<IShellItem>i;if(FAILED(d->GetResult(&i)))return{};PWSTR p=nullptr;if(FAILED(i->GetDisplayName(SIGDN_FILESYSPATH,&p)))return{};std::wstring o=p;CoTaskMemFree(p);return o;
    }
    void open(){auto p=pick(false);if(p.empty())return;try{doc=std::make_unique<Document>(loadWic(p));file=p;fit=true;InvalidateRect(hwnd,nullptr,TRUE);}catch(...){MessageBoxW(hwnd,L"Não foi possível abrir a imagem.",L"ImageForge",MB_ICONERROR);}}
    void save(bool as){if(!doc)return;auto p=(!as&&!file.empty())?file:pick(true);if(p.empty())return;try{saveWic(p,doc->composite());file=p;}catch(...){MessageBoxW(hwnd,L"Não foi possível salvar a imagem.",L"ImageForge",MB_ICONERROR);}}
    void filter(UINT id){if(!doc)return;doc->snapshot();auto&s=doc->current().img;switch(id){case ID_BRIGHT:s=brightness(s,18);break;case ID_DARK:s=brightness(s,-18);break;case ID_CONTRAST:s=contrast(s,1.12f);break;case ID_SAT:s=saturation(s,1.15f);break;case ID_GRAY:s=grayscale(s);break;case ID_INVERT:s=invert(s);break;case ID_SHARP:s=sharpen(s,.65f);break;case ID_BLUR:s=blur(s,2);break;case ID_HIGHLIGHTS:s=shadowsHighlights(s,.28f,.24f);break;case ID_BLOOM:s=reduceBloom(s,.45f);break;case ID_FLARE:s=flare(s,.7f);break;}InvalidateRect(hwnd,nullptr,TRUE);}
    void command(UINT id){switch(id){case ID_OPEN:open();break;case ID_SAVE:save(false);break;case ID_SAVEAS:save(true);break;case ID_EXIT:DestroyWindow(hwnd);break;case ID_UNDO:if(doc&&doc->doUndo())InvalidateRect(hwnd,nullptr,TRUE);break;case ID_REDO:if(doc&&doc->doRedo())InvalidateRect(hwnd,nullptr,TRUE);break;case ID_LAYER_NEW:if(doc){doc->add();InvalidateRect(hwnd,nullptr,TRUE);}break;case ID_LAYER_DUP:if(doc){doc->duplicate();InvalidateRect(hwnd,nullptr,TRUE);}break;case ID_LAYER_DEL:if(doc){doc->del();InvalidateRect(hwnd,nullptr,TRUE);}break;case ID_LAYER_FLAT:if(doc){doc->flatten();InvalidateRect(hwnd,nullptr,TRUE);}break;case ID_FIT:fit=true;InvalidateRect(hwnd,nullptr,TRUE);break;case ID_100:fit=false;InvalidateRect(hwnd,nullptr,TRUE);break;case ID_ABOUT:MessageBoxW(hwnd,L"ImageForge AI Studio Native\nVersão 1.1.2\nWin32 / C++20 / x64\n\nExecutável nativo sem Python/Tkinter.",L"Sobre",MB_ICONINFORMATION);break;default:filter(id);}}
    void paint(){
        PAINTSTRUCT ps{};HDC dc=BeginPaint(hwnd,&ps);RECT rc{};GetClientRect(hwnd,&rc);HBRUSH bg=CreateSolidBrush(RGB(18,20,26));FillRect(dc,&rc,bg);DeleteObject(bg);
        if(doc){Image im=doc->composite();int iw=im.w,ih=im.h,cw=rc.right,ch=rc.bottom,dw=iw,dh=ih;if(fit){double s=std::min(double(cw-40)/std::max(1,iw),double(ch-40)/std::max(1,ih));s=std::min(1.0,std::max(.01,s));dw=std::max(1,(int)(iw*s));dh=std::max(1,(int)(ih*s));}int x=(cw-dw)/2,y=(ch-dh)/2;BITMAPINFO bi{};bi.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);bi.bmiHeader.biWidth=iw;bi.bmiHeader.biHeight=-ih;bi.bmiHeader.biPlanes=1;bi.bmiHeader.biBitCount=32;bi.bmiHeader.biCompression=BI_RGB;SetStretchBltMode(dc,HALFTONE);StretchDIBits(dc,x,y,dw,dh,0,0,iw,ih,im.px.data(),&bi,DIB_RGB_COLORS,SRCCOPY);}
        else{SetTextColor(dc,RGB(215,225,240));SetBkMode(dc,TRANSPARENT);DrawTextW(dc,L"ImageForge AI Studio Native x64\n\nArquivo > Abrir para começar",-1,&rc,DT_CENTER|DT_VCENTER);}
        EndPaint(hwnd,&ps);
    }
    LRESULT handle(HWND h,UINT m,WPARAM w,LPARAM l){switch(m){case WM_COMMAND:command(LOWORD(w));return 0;case WM_PAINT:paint();return 0;case WM_ERASEBKGND:return 1;case WM_KEYDOWN:if(GetKeyState(VK_CONTROL)&0x8000){if(w=='O')open();else if(w=='S')save(false);else if(w=='Z'){if(doc&&doc->doUndo())InvalidateRect(h,nullptr,TRUE);}else if(w=='Y'){if(doc&&doc->doRedo())InvalidateRect(h,nullptr,TRUE);}}return 0;case WM_DESTROY:PostQuitMessage(0);return 0;}return DefWindowProcW(h,m,w,l);}
public:
    int run(HINSTANCE h,int show){
        inst=h;WNDCLASSEXW wc{sizeof(wc)};wc.style=CS_HREDRAW|CS_VREDRAW;wc.lpfnWndProc=Proc;wc.hInstance=h;wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);wc.lpszClassName=L"ImageForgeAINative112";RegisterClassExW(&wc);
        hwnd=CreateWindowExW(0,wc.lpszClassName,L"ImageForge AI Studio Native x64 — 1.1.2",WS_OVERLAPPEDWINDOW|WS_CLIPCHILDREN,CW_USEDEFAULT,CW_USEDEFAULT,1400,900,nullptr,nullptr,h,this);if(!hwnd)return 1;
        BOOL dark=TRUE;DwmSetWindowAttribute(hwnd,20,&dark,sizeof(dark));menus();ShowWindow(hwnd,show);UpdateWindow(hwnd);MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}return(int)msg.wParam;
    }
};

}

int WINAPI wWinMain(HINSTANCE h,HINSTANCE,PWSTR,int show){
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    HRESULT hr=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    iforge::App app;int rc=app.run(h,show);
    if(SUCCEEDED(hr))CoUninitialize();return rc;
}
