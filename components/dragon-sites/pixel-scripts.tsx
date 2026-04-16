import { PixelConfig } from "./pixel-config"

interface PixelScriptsProps {
  config: PixelConfig | null
}

export function PixelScripts({ config }: PixelScriptsProps) {
  if (!config || !config.provider) {
    return null
  }

  // Meta/Facebook Pixel
  if (config.provider === "meta" && config.metaPixelId) {
    return (
      <>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${config.metaPixelId}');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${config.metaPixelId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      </>
    )
  }

  // UTMify Pixel
  if (config.provider === "utmify" && config.utmifyToken) {
    return (
      <>
        <script
          src="https://cdn.utmify.com.br/scripts/utms/latest.js"
          data-utmify-prevent-xcod-sck
          data-utmify-prevent-subids
          async
          defer
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.pixelId = "${config.utmifyToken}";
              var a = document.createElement("script");
              a.setAttribute("async", "");
              a.setAttribute("defer", "");
              a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
              document.head.appendChild(a);
            `,
          }}
        />
      </>
    )
  }

  return null
}
