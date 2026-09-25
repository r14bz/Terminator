import { NetworkDevice, NetworkLink } from '../types/network';
import { CABLE_CATALOG } from '../constants/cableCatalog';
import { DEVICE_TEMPLATES } from '../constants/deviceCatalog';

export interface ExportImageOptions {
  format: 'png' | 'svg';
  theme: 'dark' | 'blueprint' | 'light' | 'transparent';
  scale: 1 | 2; // 1x or 2x HD
  includeLabels: boolean;
  includeIpBadges: boolean;
  includeWatermark: boolean;
  topologyName: string;
}

/**
 * Generates an SVG string representation of the network topology
 */
export function generateTopologySvg(
  devices: NetworkDevice[],
  links: NetworkLink[],
  options: ExportImageOptions,
): { svgString: string; width: number; height: number } {
  const padding = 80;

  if (devices.length === 0) {
    const width = 800;
    const height = 500;
    const bg = options.theme === 'light' ? '#f8fafc' : options.theme === 'blueprint' ? '#0f172a' : '#020617';
    return {
      svgString: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${options.theme === 'transparent' ? 'none' : bg}"/>
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="16">Kanvas Topologi Kosong</text>
      </svg>`,
      width,
      height,
    };
  }

  // Calculate bounding box of all devices
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  devices.forEach((d) => {
    minX = Math.min(minX, d.x);
    minY = Math.min(minY, d.y);
    maxX = Math.max(maxX, d.x + 80);
    maxY = Math.max(maxY, d.y + 80);
  });

  const contentWidth = Math.max(700, maxX - minX + padding * 2);
  const contentHeight = Math.max(500, maxY - minY + padding * 2 + (options.includeWatermark ? 60 : 0));

  const offsetX = padding - minX;
  const offsetY = padding - minY + (options.includeWatermark ? 50 : 0);

  // Background styling
  let bgColor = '#020617';
  let gridColor = 'rgba(148, 163, 184, 0.08)';
  let textColor = '#f8fafc';
  let textSubColor = '#94a3b8';
  let nodeBg = '#0f172a';
  let nodeBorder = '#334155';

  if (options.theme === 'light') {
    bgColor = '#ffffff';
    gridColor = 'rgba(100, 116, 139, 0.12)';
    textColor = '#0f172a';
    textSubColor = '#475569';
    nodeBg = '#f8fafc';
    nodeBorder = '#cbd5e1';
  } else if (options.theme === 'blueprint') {
    bgColor = '#0a192f';
    gridColor = 'rgba(56, 189, 248, 0.12)';
    textColor = '#e2e8f0';
    textSubColor = '#38bdf8';
    nodeBg = '#112240';
    nodeBorder = '#1e3a8a';
  } else if (options.theme === 'transparent') {
    bgColor = 'none';
    gridColor = 'none';
  }

  const svgParts: string[] = [];

  // SVG Opening
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${contentWidth} ${contentHeight}" width="${contentWidth}" height="${contentHeight}">`,
  );

  // Background rect
  if (options.theme !== 'transparent') {
    svgParts.push(`<rect width="${contentWidth}" height="${contentHeight}" fill="${bgColor}" />`);
    // Grid pattern
    svgParts.push(`
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="${gridColor}" />
        </pattern>
      </defs>
      <rect width="${contentWidth}" height="${contentHeight}" fill="url(#grid)" />
    `);
  }

  // Header Title & Watermark
  if (options.includeWatermark) {
    svgParts.push(`
      <g id="header-watermark">
        <text x="30" y="36" fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold">${escapeXml(options.topologyName)}</text>
        <text x="30" y="52" fill="${textSubColor}" font-family="system-ui, -apple-system, sans-serif" font-size="11">TERMINATOR Diagram • Diekspor pada: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • Total: ${devices.length} Perangkat, ${links.length} Tautan</text>
        <line x1="30" y1="62" x2="${contentWidth - 30}" y2="62" stroke="${nodeBorder}" stroke-width="1" opacity="0.6"/>
      </g>
    `);
  }

  // Cable Links layer
  svgParts.push('<g id="cable-links">');
  links.forEach((link) => {
    const devA = devices.find((d) => d.id === link.fromDeviceId);
    const devB = devices.find((d) => d.id === link.toDeviceId);
    if (!devA || !devB) return;

    const posA = { x: devA.x + 38 + offsetX, y: devA.y + 38 + offsetY };
    const posB = { x: devB.x + 38 + offsetX, y: devB.y + 38 + offsetY };

    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const normalX = -dy * 0.08;
    const normalY = dx * 0.08;
    const ctrlX = midX + normalX;
    const ctrlY = midY + normalY;

    const spec = CABLE_CATALOG[link.cableType] || CABLE_CATALOG['ethernet_straight'];
    const strokeColor = link.status === 'down' ? '#ef4444' : spec.color;
    const strokeDash = link.status === 'down' ? '4 4' : spec.strokeDashArray || '';

    // Cable line
    svgParts.push(
      `<path d="M ${posA.x} ${posA.y} Q ${ctrlX} ${ctrlY} ${posB.x} ${posB.y}" fill="none" stroke="${strokeColor}" stroke-width="2.5" ${strokeDash ? `stroke-dasharray="${strokeDash}"` : ''} stroke-linecap="round" />`,
    );

    // End points status
    const portA = devA.ports.find((p) => p.id === link.fromPortId);
    const portB = devB.ports.find((p) => p.id === link.toPortId);
    svgParts.push(
      `<circle cx="${posA.x}" cy="${posA.y}" r="3.5" fill="${portA?.isUp ? '#10b981' : '#ef4444'}" stroke="#0f172a" stroke-width="1.2" />`,
    );
    svgParts.push(
      `<circle cx="${posB.x}" cy="${posB.y}" r="3.5" fill="${portB?.isUp ? '#10b981' : '#ef4444'}" stroke="#0f172a" stroke-width="1.2" />`,
    );

    // Cable label
    if (options.includeLabels) {
      svgParts.push(`
        <g transform="translate(${midX}, ${midY - 14})">
          <rect x="-35" y="-10" width="70" height="18" rx="4" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="0.8" opacity="0.9" />
          <text x="0" y="3" text-anchor="middle" fill="${textSubColor}" font-family="monospace" font-size="9" font-weight="500">${link.lengthMeters}m ${spec.category === 'optical' ? '• FO' : ''}</text>
        </g>
      `);
    }
  });
  svgParts.push('</g>');

  // Devices layer
  svgParts.push('<g id="device-nodes">');
  devices.forEach((dev) => {
    const tmpl = DEVICE_TEMPLATES[dev.type] || DEVICE_TEMPLATES['pc'];
    const x = dev.x + offsetX;
    const y = dev.y + offsetY;
    const isOnline = dev.status === 'online';

    const primaryPort = dev.ports.find((p) => p.isUp && p.ipAddress);
    const ipDisplay = primaryPort?.ipAddress;

    svgParts.push(`
      <g id="node-${dev.id}" transform="translate(${x}, ${y})">
        <!-- Box Shape -->
        <rect x="0" y="0" width="76" height="76" rx="16" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="2" />
        
        <!-- Status Indicator Dot -->
        <circle cx="66" cy="10" r="4.5" fill="${isOnline ? '#10b981' : '#ef4444'}" stroke="${nodeBg}" stroke-width="1.5" />
        
        <!-- Device Category Icon Representation -->
        <circle cx="38" cy="38" r="20" fill="${tmpl.color}25" />
        <rect x="26" y="26" width="24" height="24" rx="5" fill="${tmpl.color}" opacity="0.9" />
        <text x="38" y="42" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="11" font-weight="bold">${dev.type.substring(0, 2).toUpperCase()}</text>

        <!-- Hostname -->
        <text x="38" y="94" text-anchor="middle" fill="${textColor}" font-family="system-ui, sans-serif" font-size="11" font-weight="bold">${escapeXml(dev.name)}</text>
    `);

    // IP address badge
    if (options.includeIpBadges && ipDisplay) {
      svgParts.push(`
        <rect x="-10" y="100" width="96" height="16" rx="4" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="0.8" />
        <text x="38" y="112" text-anchor="middle" fill="#34d399" font-family="monospace" font-size="9" font-weight="500">${ipDisplay}</text>
      `);
    } else {
      svgParts.push(`
        <text x="38" y="108" text-anchor="middle" fill="${textSubColor}" font-family="system-ui, sans-serif" font-size="9">${dev.type.replace('_', ' ').toUpperCase()}</text>
      `);
    }

    svgParts.push('</g>');
  });
  svgParts.push('</g>');

  svgParts.push('</svg>');

  return {
    svgString: svgParts.join('\n'),
    width: contentWidth,
    height: contentHeight,
  };
}

/**
 * Escapes characters for clean XML/SVG embedding
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * Exports current topology as SVG file download
 */
export function downloadTopologySvg(
  devices: NetworkDevice[],
  links: NetworkLink[],
  options: ExportImageOptions,
) {
  const { svgString } = generateTopologySvg(devices, links, options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = options.topologyName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Topologi';
  a.download = `${safeName}_Diagram.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports current topology as PNG file download via HTML5 Canvas rasterization
 */
export function downloadTopologyPng(
  devices: NetworkDevice[],
  links: NetworkLink[],
  options: ExportImageOptions,
  onComplete?: () => void,
) {
  const { svgString, width, height } = generateTopologySvg(devices, links, options);
  const scale = options.scale || 2; // Default 2x for sharp retina graphics

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const URLObj = window.URL || window.webkitURL || window;
  const svgUrl = URLObj.createObjectURL(svgBlob);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URLObj.revokeObjectURL(svgUrl);
      return;
    }

    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const pngUrl = URLObj.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        const safeName = options.topologyName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Topologi';
        a.download = `${safeName}_Diagram.png`;
        a.click();
        URLObj.revokeObjectURL(pngUrl);
      }
      URLObj.revokeObjectURL(svgUrl);
      if (onComplete) onComplete();
    }, 'image/png');
  };

  img.src = svgUrl;
}

/**
 * Copies the topology image to clipboard as PNG
 */
export async function copyTopologyImageToClipboard(
  devices: NetworkDevice[],
  links: NetworkLink[],
  options: ExportImageOptions,
): Promise<boolean> {
  const { svgString, width, height } = generateTopologySvg(devices, links, options);
  const scale = 2;

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        resolve(false);
        return;
      }

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) {
          resolve(false);
          return;
        }

        try {
          // Navigator clipboard write image
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      resolve(false);
    };

    img.src = svgUrl;
  });
}
