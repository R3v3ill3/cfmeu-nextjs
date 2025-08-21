import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
        <defs>
          <style>
            {`.bg{fill:#0b2a5b}.cross{fill:#ffffff}.star{fill:#ffffff}`}
          </style>
          <g id="star8">
            <polygon className="star" points="128,100 138,118 160,128 138,138 128,156 118,138 96,128 118,118"/>
            <polygon className="star" points="128,92 146,110 164,128 146,146 128,164 110,146 92,128 110,110"/>
          </g>
        </defs>
        <rect className="bg" x="0" y="0" width="256" height="256"/>
        <rect className="cross" x="32" y="110" width="192" height="36" rx="6"/>
        <rect className="cross" x="110" y="32" width="36" height="192" rx="6"/>
        <use href="#star8" x="0" y="0" />
        <g transform="translate(0,-88)"><use href="#star8"/></g>
        <g transform="translate(0,88)"><use href="#star8"/></g>
        <g transform="translate(-88,0)"><use href="#star8"/></g>
        <g transform="translate(88,0)"><use href="#star8"/></g>
      </svg>
    ),
    size
  );
}

