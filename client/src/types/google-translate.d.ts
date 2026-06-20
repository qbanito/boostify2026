declare interface Window {
  google: {
    translate: {
      TranslateElement: {
        new (options: {
          pageLanguage: string;
          includedLanguages: string;
          layout: any;
          autoDisplay: boolean;
        }, elementId: string): any;
        InlineLayout: {
          SIMPLE: string;
        };
      };
    };
  };
  googleTranslateElementInit: () => void;
}
