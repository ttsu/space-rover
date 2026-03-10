import {
  Actor,
  Color,
  NineSlice,
  NineSliceStretch,
  vec,
  type Vector,
} from "excalibur";
import { Resources } from "../resources";

/** Source image is 128x128; corners/notches extend ~34px from each edge. */
const PANEL_SOURCE_SIZE = 128;
const PANEL_SLICE_MARGIN = 34;

export interface PanelOptions {
  pos: Vector;
  width: number;
  height: number;
  /** Optional tint (default: white). */
  tint?: Color;
}

/**
 * Nine-slice UI panel using the glass notches image. Corners and borders
 * are preserved; center stretches. Add to a scene and attach children for content.
 */
export class Panel extends Actor {
  constructor(options: PanelOptions) {
    const { pos, width, height, tint } = options;
    super({
      pos,
      width,
      height,
      color: Color.Transparent,
      anchor: vec(0, 0),
    });

    const graphic = new NineSlice({
      width,
      height,
      source: Resources.PanelGlassNotches,
      tint: tint ?? Color.White,
      sourceConfig: {
        width: PANEL_SOURCE_SIZE,
        height: PANEL_SOURCE_SIZE,
        leftMargin: PANEL_SLICE_MARGIN,
        topMargin: PANEL_SLICE_MARGIN,
        rightMargin: PANEL_SLICE_MARGIN,
        bottomMargin: PANEL_SLICE_MARGIN,
      },
      destinationConfig: {
        drawCenter: true,
        horizontalStretch: NineSliceStretch.Stretch,
        verticalStretch: NineSliceStretch.Stretch,
      },
      // scale: vec(0.5, 0.5),
      opacity: 0.5,
    });
    this.graphics.use(graphic);
  }
}
