declare module 'html2pdf.js' {
  export interface Html2PdfOptions {
    margin?: number;
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      [key: string]: any;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: 'portrait' | 'landscape';
      [key: string]: any;
    };
  }
  
  export interface Html2PdfChain {
    set: (options: Html2PdfOptions) => Html2PdfChain;
    from: (element: HTMLElement | string) => Html2PdfChain;
    save: () => void;
    output: (type: string, options?: any) => any;
    then: (callback: (pdf: any) => void) => Html2PdfChain;
    catch: (callback: (error: Error) => void) => Html2PdfChain;
  }
  
  export default function html2pdf(): Html2PdfChain;
  export default function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Html2PdfChain;
}