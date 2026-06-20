// Este archivo configura el soporte completo de JSX para TypeScript
import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    
    // Definiciones para elementos HTML estándar
    interface Element extends React.ReactElement<any, any> {}
    
    // Definición de fragmentos
    interface ElementChildrenAttribute {
      children: {};
    }
    
    // Atributos de componentes
    interface IntrinsicAttributes extends React.Attributes {}
    
    // Atributos para elementos DOM
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}
  }
}