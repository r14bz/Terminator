import React, { useState, useRef, useEffect } from 'react';
import { X, Terminal as TerminalIcon, CornerDownLeft, Trash2 } from 'lucide-react';
import type { NetworkNode } from '../types/network';
import { findNodeByAddress, isSameSubnet, isValidIpv4 } from '../utils/ipUtils';

type TerminalLine = { text: string; type: 'cmd' | 'output' | 'error' };

/**
 * Pure command interpreter: appends the echo of `cmd` plus its reply to
 * `prior` and returns the new scrollback. Kept out of the component so the
 * mount effect can replay a command without depending on `history` state.
 */
function replyTo(prior: TerminalLine[], cmd: string, node: NetworkNode, nodes: NetworkNode[]): TerminalLine[] {
  const isMikrotik = node.type === 'mikrotik';
  const newHistory: TerminalLine[] = [...prior, { type: 'cmd', text: `${isMikrotik ? '[admin@MikroTik] > ' : 'C:\\Users\\Teknisi> '}${cmd}` }];

  {
    const parts = cmd.toLowerCase().split(/\s+/);
    const mainCmd = parts[0];

    if (mainCmd === 'clear' || mainCmd === 'cls') {
      return [];
    }

    if (mainCmd === 'help') {
      if (isMikrotik) {
        newHistory.push({
          type: 'output',
          text: `Perintah RouterOS MikroTik yang didukung:
  /interface print       - Tampilkan daftar interface & status fisik
  /ip address print      - Tampilkan daftar alamat IP interface
  /ip firewall nat print - Tampilkan rule NAT Masquerade
  /ping <ip>             - Uji koneksi ICMP ke perangkat target
  /system resource print - Tampilkan beban CPU & RAM
  clear                  - Bersihkan layar`,
        });
      } else {
        newHistory.push({
          type: 'output',
          text: `Perintah Windows CMD yang didukung:
  ipconfig [/all]        - Tampilkan IP, Subnet, dan Gateway perangkat
  ping <ip>              - Kirim 4 paket ICMP Echo Request ke tujuan
  tracert <ip>           - Lacak rute hop jaringan menuju target
  clear                  - Bersihkan layar terminal
  help                   - Bantuan perintah`,
        });
      }
    } else if (mainCmd === 'ipconfig') {
      newHistory.push({
        type: 'output',
        text: `\nWindows IP Configuration\n
Ethernet adapter Local Area Connection:
   Connection-specific DNS Suffix  . : lan
   Link-local IPv6 Address . . . . . : fe80::9c21:38df:7621:99e1%12
   IPv4 Address. . . . . . . . . . . : ${node.ipConfig?.ip || '169.254.12.8 (APIPA - DHCP Gagal)'}
   Subnet Mask . . . . . . . . . . . : ${node.ipConfig?.subnet || '255.255.0.0'}
   Default Gateway . . . . . . . . . : ${node.ipConfig?.gateway || '(Kosong - Tidak Ada Akses Internet)'}
   DNS Servers . . . . . . . . . . . : ${node.ipConfig?.dns || '8.8.8.8'}`,
      });
    } else if (mainCmd === 'ping' || (isMikrotik && parts[1] === 'ping') || parts[0] === '/ping') {
      const targetIp = parts[1] === 'ping' ? parts[2] : parts[1];
      if (!targetIp) {
        newHistory.push({ type: 'error', text: 'Error: Alamat IP target belum dimasukkan! Contoh: ping 192.168.1.1' });
      } else {
        const hostIp = node.ipConfig?.ip || '';
        const hostSubnet = node.ipConfig?.subnet || '255.255.255.0';
        const hostGateway = node.ipConfig?.gateway || '';

        // Find if target node exists with this IP
        const targetNode = findNodeByAddress(nodes, targetIp);

        if (!node.poweredOn) {
          newHistory.push({ type: 'error', text: 'Koneksi gagal: Perangkat ini dalam keadaan mati (Power Off).' });
        } else if (isValidIpv4(hostIp) && isValidIpv4(targetIp)) {
          const inSameSubnet = isSameSubnet(hostIp, targetIp, hostSubnet);

          // If target is in different subnet, traffic must route through Default Gateway!
          if (!inSameSubnet) {
            const isGatewayReachable =
              hostGateway &&
              isValidIpv4(hostGateway) &&
              isSameSubnet(hostIp, hostGateway, hostSubnet);

            const gatewayNode = nodes.find(
              (n) => (n.ontConfig?.lanIp === hostGateway || n.ipConfig?.ip === hostGateway) && n.poweredOn
            );

            if (!hostGateway || hostGateway === '0.0.0.0') {
              newHistory.push({
                type: 'error',
                text: `\nPinging ${targetIp} with 32 bytes of data:\nReply from ${hostIp}: Destination host unreachable.\nReply from ${hostIp}: Destination host unreachable.\nReply from ${hostIp}: Destination host unreachable.\nReply from ${hostIp}: Destination host unreachable.\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\n[Error]: Default Gateway KOSONG! Host tidak memiliki rute keluar untuk menjangkau ${targetIp}.`,
              });
              return newHistory;
            } else if (!isGatewayReachable) {
              newHistory.push({
                type: 'error',
                text: `\nPinging ${targetIp} with 32 bytes of data:\nReply from ${hostIp}: Destination host unreachable.\nReply from ${hostIp}: Destination host unreachable.\nReply from ${hostIp}: Destination host unreachable.\nReply from ${hostIp}: Destination host unreachable.\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\n[Error]: Gateway Salah! Host (${hostIp}) dan Default Gateway (${hostGateway}) berada di subnet berbeda.`,
              });
              return newHistory;
            } else if (!gatewayNode) {
              newHistory.push({
                type: 'error',
                text: `\nPinging ${targetIp} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\n[Error]: Router Gateway (${hostGateway}) tidak merespon ARP / mati.`,
              });
              return newHistory;
            } else if (gatewayNode.type === 'ont' && gatewayNode.ontConfig?.wanMode === 'bridge') {
              newHistory.push({
                type: 'error',
                text: `\nPinging ${targetIp} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\n[Error]: Gateway "${gatewayNode.name}" dalam Mode Bridge (Layer 2). Modem tidak memiliki fungsi routing/NAT untuk meneruskan paket ke luar! Diperlukan router (seperti MikroTik) untuk dial PPPoE.`,
              });
              return newHistory;
            }
          }

          // If reached here: either in same subnet or routed through valid gateway
          if (targetNode && targetNode.poweredOn) {
            const latency = Math.floor(Math.random() * 8) + 2;
            newHistory.push({
              type: 'output',
              text: `\nPinging ${targetIp} with 32 bytes of data:\nReply from ${targetIp}: bytes=32 time=${latency}ms TTL=64\nReply from ${targetIp}: bytes=32 time=${latency + 1}ms TTL=64\nReply from ${targetIp}: bytes=32 time=${latency}ms TTL=64\nReply from ${targetIp}: bytes=32 time=${latency + 2}ms TTL=64\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${latency}ms, Maximum = ${latency + 2}ms, Average = ${latency + 1}ms`,
            });
          } else {
            newHistory.push({
              type: 'error',
              text: `\nPinging ${targetIp} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\nTips: Periksa apakah perangkat target (${targetIp}) hidup dan terhubung ke jaringan.`,
            });
          }
        } else if (targetNode && targetNode.poweredOn) {
          const latency = Math.floor(Math.random() * 8) + 2;
          newHistory.push({
            type: 'output',
            text: `\nPinging ${targetIp} with 32 bytes of data:\nReply from ${targetIp}: bytes=32 time=${latency}ms TTL=64\nReply from ${targetIp}: bytes=32 time=${latency + 1}ms TTL=64\nReply from ${targetIp}: bytes=32 time=${latency}ms TTL=64\nReply from ${targetIp}: bytes=32 time=${latency + 2}ms TTL=64\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${latency}ms, Maximum = ${latency + 2}ms, Average = ${latency + 1}ms`,
          });
        } else {
          newHistory.push({
            type: 'error',
            text: `\nPinging ${targetIp} with 32 bytes of data:\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${targetIp}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss).\nTips: Periksa apakah perangkat target hidup, kabel terhubung, atau ada salah subnet/gateway.`,
          });
        }
      }
    } else if (cmd.includes('interface print')) {
      newHistory.push({
        type: 'output',
        text: `Flags: D - DYNAMIC; X - DISABLED, R - RUNNING
 #    NAME         TYPE       ACTUAL-MTU   MAC-ADDRESS
 0  R ether1-WAN   ether            1500   48:8F:5A:11:22:01
 1  R ether2-LAN   ether            1500   48:8F:5A:11:22:02
 2    ether3-OPT   ether            1500   48:8F:5A:11:22:03
 3    ether4       ether            1500   48:8F:5A:11:22:04
 4    ether5       ether            1500   48:8F:5A:11:22:05`,
      });
    } else if (cmd.includes('address print')) {
      newHistory.push({
        type: 'output',
        text: `Flags: X - DISABLED, I - INVALID, D - DYNAMIC
 #   ADDRESS            NETWORK         INTERFACE
 0   ${node.ipConfig?.ip || '192.168.88.1'}/24     192.168.88.0    ether2-LAN
 1 D 180.252.10.15/24   180.252.10.0    ether1-WAN`,
      });
    } else if (cmd.includes('nat print')) {
      newHistory.push({
        type: 'output',
        text: `Flags: X - DISABLED, I - INVALID
 #   CHAIN      ACTION       OUT-INTERFACE
 0   srcnat     masquerade   ether1-WAN    ${node.mikrotikConfig?.firewallNat ? '(ENABLED)' : '(DISABLED - Klien tidak bisa internet)'}`,
      });
    } else {
      newHistory.push({
        type: 'error',
        text: isMikrotik
          ? `bad command name ${cmd} (type 'help' for options)`
          : `'${cmd}' is not recognized as an internal or external command. Ketik 'help' untuk daftar perintah.`,
      });
    }

    return newHistory;
  }
}

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: NetworkNode | null;
  nodes: NetworkNode[];
  /**
   * IP to ping as soon as the session opens. The canvas ping tool hands this
   * over so that picking two nodes actually runs the test rather than leaving
   * the user at a bare prompt with the target silently dropped.
   */
  pingTargetIp?: string | null;
}

export const TerminalModal: React.FC<TerminalModalProps> = ({
  isOpen,
  onClose,
  node,
  nodes,
  pingTargetIp,
}) => {
  // Returning null unmounts the session, which is what clears scrollback and
  // focus on the next open — so this check must stay above the session.
  if (!isOpen || !node) return null;
  return (
    <TerminalSession
      node={node}
      nodes={nodes}
      pingTargetIp={pingTargetIp ?? null}
      onClose={onClose}
    />
  );
};

interface TerminalSessionProps {
  node: NetworkNode;
  nodes: NetworkNode[];
  pingTargetIp: string | null;
  onClose: () => void;
};

const TerminalSession: React.FC<TerminalSessionProps> = ({ node, nodes, pingTargetIp, onClose }) => {
  const isMikrotik = node.type === 'mikrotik';
  const [history, setHistory] = useState<TerminalLine[]>(() => [
    {
      type: 'output',
      text: isMikrotik
        ? `  MikroTik RouterOS 7.15 (c) 1999-2026\n  Terminal Network Simulator Edition\n  Type 'help' or '/interface print' to start.`
        : `Microsoft Windows [Version 10.0.19045.3803]\n(c) Microsoft Corporation. All rights reserved.\nKetik 'help' atau 'ipconfig' untuk diagnosa jaringan.`,
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;
    setInputVal('');
    setHistory((prev) => replyTo(prev, cmd, node, nodes));
  };

  // Replay the canvas-picked target once per session. The session is remounted
  // on every open, so an empty dependency list runs this exactly once.
  const replayedRef = useRef(false);
  useEffect(() => {
    if (replayedRef.current) return;
    replayedRef.current = true;
    if (pingTargetIp) {
      runCommand(isMikrotik ? `/ping ${pingTargetIp}` : `ping ${pingTargetIp}`);
    }
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(inputVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[75vh] w-full max-w-2xl flex-col rounded-2xl bg-slate-950 text-slate-100 shadow-2xl border border-slate-800 overflow-hidden font-mono">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              {isMikrotik ? `MikroTik Terminal Console - ${node.name}` : `Command Prompt (CMD) - ${node.name}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistory([])}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Bersihkan Layar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Terminal Screen */}
        <div className="flex-1 overflow-y-auto p-4 text-[12px] space-y-1.5 leading-relaxed selection:bg-emerald-900">
          {history.map((line, idx) => (
            <div
              key={idx}
              className={`whitespace-pre-wrap ${
                line.type === 'cmd'
                  ? 'text-sky-400 font-bold'
                  : line.type === 'error'
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleCommand} className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 px-4 py-2 text-xs">
          <span className="text-emerald-400 shrink-0 font-bold">
            {isMikrotik ? '[admin@MikroTik] >' : 'C:\\>'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={isMikrotik ? 'contoh: /interface print, /ping 8.8.8.8' : 'contoh: ping 192.168.1.1, ipconfig'}
            className="flex-1 bg-transparent text-emerald-300 focus:outline-none placeholder:text-slate-600 font-mono text-xs"
          />
          <button
            type="submit"
            className="rounded p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
          >
            <CornerDownLeft className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
