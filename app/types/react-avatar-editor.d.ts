declare module "react-avatar-editor" {
  import { Component } from "react";

  interface AvatarEditorProps {
    image: string | File;
    width: number;
    height: number;
    border?: number;
    borderRadius?: number;
    scale?: number;
    rotate?: number;
    color?: [number, number, number, number];
    className?: string;
    style?: React.CSSProperties;
  }

  export default class AvatarEditor extends Component<AvatarEditorProps> {
    getImageScaledToCanvas(): HTMLCanvasElement;
    getImage(): HTMLCanvasElement;
    getCroppingRect(): { x: number; y: number; width: number; height: number };
  }
}
