import type { NetworkNode, CableConnection, DiagnosticIssue } from '../types/network';
import type { OpticalCalculationResult } from './opticalCalculator';
import { isValidIpv4, isSameSubnet, findUpstreamGateway } from './ipUtils';

export function runNetworkDiagnostics(
  nodes: NetworkNode[],
  cables: CableConnection[],
  opticalResults: Map<string, OpticalCalculationResult>
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];

  // Check 1: Powered off devices
  for (const node of nodes) {
    if (!node.poweredOn && node.type !== 'splitter' && node.type !== 'odc' && node.type !== 'odp') {
      issues.push({
        id: `power-${node.id}`,
        severity: 'critical',
        title: `${node.name} Dalam Keadaan Mati (Power Off)`,
        targetNodeId: node.id,
        category: 'physical',
        cause: `Perangkat "${node.name}" (${node.label}) belum dinyalakan atau adaptor listrik belum terpasang.`,
        solution: `Klik perangkat "${node.name}" pada kanvas dan tekan tombol "Nyalakan Power" di panel kontrol samping.`,
      });
    }
  }

  // Check 2: Isolated devices with no connections
  for (const node of nodes) {
    const connectedCables = cables.filter(
      (c) => c.fromNodeId === node.id || c.toNodeId === node.id
    );
    if (connectedCables.length === 0) {
      issues.push({
        id: `isolated-${node.id}`,
        severity: 'warning',
        title: `${node.name} Belum Terhubung Kabel Apa Pun`,
        targetNodeId: node.id,
        category: 'physical',
        cause: `Perangkat "${node.name}" berdiri sendiri tanpa ada kabel penghubung ke perangkat jaringan lain.`,
        solution: `Gunakan tombol "Hubungkan Kabel" di toolbar, pilih jenis kabel yang sesuai (FO/LAN/Wireless), lalu hubungkan port ${node.name} ke perangkat tujuan.`,
      });
    }
  }

  // Check 3: Broken cables
  for (const cable of cables) {
    if (cable.status === 'broken') {
      const fromNode = nodes.find((n) => n.id === cable.fromNodeId);
      const toNode = nodes.find((n) => n.id === cable.toNodeId);
      issues.push({
        id: `broken-${cable.id}`,
        severity: 'critical',
        title: `Kabel ${cable.type.toUpperCase()} Putus (Fiber Cut / Cable Severed)`,
        targetCableId: cable.id,
        category: 'physical',
        cause: `Terdeteksi putusnya transmisi fisik antara ${fromNode?.name || 'Node'} dan ${toNode?.name || 'Node'}. Pada dunia nyata bisa disebabkan oleh kabel terkena galian, tersangkut truk, atau gigitan tikus.`,
        solution: `Klik kabel tersebut dan ganti dengan kabel baru, atau perbaiki sambungan kabel dengan fusion splicer / crimping RJ45 baru.`,
      });
    }
  }

  // Check 4: Optical Power Budget & LOS issues (ONT, ODP, ODC)
  for (const node of nodes) {
    if (node.type === 'ont') {
      const optResult = opticalResults.get(node.id);
      if (!optResult || optResult.status === 'disconnected') {
        issues.push({
          id: `ont-los-${node.id}`,
          severity: 'critical',
          title: `ONT "${node.name}" Mengalami Alarm LOS (Lampu Merah Kedip)`,
          targetNodeId: node.id,
          category: 'optical',
          cause: `Tidak ada sinyal optik yang diterima dari OLT / ODP ke port PON modem ONT. Lampu indikator LOS menyala merah karena link fiber terputus.`,
          solution: `Tarik kabel "Drop Core" dari port ODP tiang terdekat menuju port PON di ONT. Pastikan ODP terhubung ke ODC dan OLT sudah dinyalakan.`,
        });
      } else if (optResult.status === 'critical_los') {
        issues.push({
          id: `ont-attenuation-${node.id}`,
          severity: 'critical',
          title: `Redaman Optik Buruk (${optResult.rxPowerDbm} dBm) di ONT "${node.name}"`,
          targetNodeId: node.id,
          category: 'optical',
          cause: `Daya terima optik (${optResult.rxPowerDbm} dBm) lebih buruk dari batas toleransi standar ITU-T G.984 (-27.0 dBm). Hal ini menyebabkan koneksi internet putus-nyambung atau gagal sinkronisasi PON.`,
          solution: `Langkah Teknisi: 1. Cek tekukan kabel (macro-bending). 2. Bersihkan konektor SC/UPC dengan alkohol isopropil 99%. 3. Cek apakah ada splitter berantai yang terlalu banyak (misal 1:8 disambung ke 1:16). 4. Potong ulang ujung fiber dengan precision cleaver.`,
        });
      } else if (optResult.status === 'acceptable') {
        issues.push({
          id: `ont-marginal-${node.id}`,
          severity: 'warning',
          title: `Redaman Optik Mendekati Batas Kritis (${optResult.rxPowerDbm} dBm)`,
          targetNodeId: node.id,
          category: 'optical',
          cause: `Daya terima optik berada pada rentang marjinal (-24 s/d -27 dBm). Koneksi masih berjalan, namun rentan drop jika suhu kabel naik atau cuaca buruk.`,
          solution: `Lakukan pemeliharaan preventif: bersihkan adaptor ODP dan roset, serta pastikan tidak ada beban berlebih pada tarikan kabel drop.`,
        });
      } else if (optResult.status === 'overpower') {
        issues.push({
          id: `ont-overpower-${node.id}`,
          severity: 'warning',
          title: `Sinyal Optik Terlalu Kuat (Overpower > -8 dBm)`,
          targetNodeId: node.id,
          category: 'optical',
          cause: `Daya terima optik (${optResult.rxPowerDbm} dBm) melebihi batas aman fotodioda receiver ONT. Hal ini biasanya terjadi jika ONT dicolok langsung ke OLT tanpa splitter pasif.`,
          solution: `Pasang splitter optik (minimal 1:4 atau 1:8) atau pasang optical attenuator (misal 5dB / 10dB) agar sensor optik ONT tidak terbakar.`,
        });
      }
    }
  }

  // Check 5: Media Converter (HTB) Pairing Check
  const htbNodes = nodes.filter((n) => n.type === 'htb');
  for (const htb of htbNodes) {
    const opticalConn = cables.find(
      (c) =>
        ['feeder', 'distribusi', 'drop_core'].includes(c.type) &&
        (c.fromNodeId === htb.id || c.toNodeId === htb.id)
    );
    if (opticalConn) {
      const peerId = opticalConn.fromNodeId === htb.id ? opticalConn.toNodeId : opticalConn.fromNodeId;
      const peerNode = nodes.find((n) => n.id === peerId);
      if (peerNode?.type === 'htb') {
        if (htb.htbRole && peerNode.htbRole && htb.htbRole === peerNode.htbRole) {
          issues.push({
            id: `htb-mismatch-${htb.id}`,
            severity: 'critical',
            title: `Ketidakcocokan Pasangan HTB Converter (${htb.htbRole} bertemu ${peerNode.htbRole})`,
            targetNodeId: htb.id,
            category: 'physical',
            cause: `Kedua media converter menggunakan frekuensi gelombang yang sama (${htb.htbRole}). HTB Tipe A (Tx 1310nm) harus dipasangkan dengan HTB Tipe B (Tx 1550nm).`,
            solution: `Ubah salah satu HTB menjadi tipe ${htb.htbRole === 'A' ? 'B' : 'A'} pada pengaturan konfigurasi perangkat.`,
          });
        }
      }
    }
  }

  // Check 6: IP Conflicts (Duplikasi IP)
  const ipMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.ipConfig?.ip && node.ipConfig.mode === 'static' && node.poweredOn) {
      const ip = node.ipConfig.ip.trim();
      if (ip && ip !== '0.0.0.0') {
        const existing = ipMap.get(ip) || [];
        existing.push(node.name);
        ipMap.set(ip, existing);
      }
    }
  }

  for (const [ip, nodeNames] of ipMap.entries()) {
    if (nodeNames.length > 1) {
      issues.push({
        id: `ip-conflict-${ip}`,
        severity: 'critical',
        title: `Konflik Alamat IP: ${ip} Digunakan Oleh ${nodeNames.join(' & ')}`,
        category: 'ip',
        cause: `Dua perangkat atau lebih memiliki alamat IP statis yang sama (${ip}) dalam jaringan. Ini menyebabkan tabrakan ARP (ARP spoofing / duplicate IP) dan memutuskan koneksi internet secara acak.`,
        solution: `Buka pengaturan salah satu perangkat (${nodeNames.join(' atau ')}) dan ganti angka terakhir IP ke host yang belum terpakai, atau ubah mode menjadi "DHCP Client".`,
      });
    }
  }

  // Check 7: Missing Gateway on Clients (PC / CCTV / Server / Smartphone / IoT)
  for (const node of nodes) {
    if (['pc', 'cctv', 'server', 'smartphone', 'iot'].includes(node.type) && node.poweredOn) {
      if (node.ipConfig?.mode === 'static' && (!node.ipConfig.gateway || node.ipConfig.gateway === '0.0.0.0')) {
        issues.push({
          id: `no-gw-${node.id}`,
          severity: 'warning',
          title: `Default Gateway Kosong pada "${node.name}"`,
          targetNodeId: node.id,
          category: 'configuration',
          cause: `Perangkat tidak memiliki alamat gateway rute keluar, sehingga tidak dapat mengakses internet, server NVR, atau subnet lain di luar LAN lokal.`,
          solution: `Isi kolom "Default Gateway" pada ${node.name} dengan alamat IP LAN router Anda (misal 192.168.1.1 atau 192.168.88.1).`,
        });
      }
    }
  }

  // Check 8: Subnet Mismatch between Host IP and its own Gateway
  for (const node of nodes) {
    if (['pc', 'cctv', 'server', 'smartphone', 'iot'].includes(node.type) && node.poweredOn) {
      if (node.ipConfig?.mode === 'static' && node.ipConfig.ip && node.ipConfig.gateway) {
        const subnetMask = node.ipConfig.subnet || '255.255.255.0';
        if (
          isValidIpv4(node.ipConfig.ip) &&
          isValidIpv4(node.ipConfig.gateway) &&
          isValidIpv4(subnetMask) &&
          node.ipConfig.gateway !== '0.0.0.0'
        ) {
          if (!isSameSubnet(node.ipConfig.ip, node.ipConfig.gateway, subnetMask)) {
            issues.push({
              id: `subnet-mismatch-gw-${node.id}`,
              severity: 'critical',
              title: `Subnet Gateway Tidak Cocok pada "${node.name}"`,
              targetNodeId: node.id,
              category: 'ip',
              cause: `Alamat IP host (${node.ipConfig.ip}) dan Default Gateway (${node.ipConfig.gateway}) berada pada segmen network/subnet yang berbeda (Subnet: ${subnetMask}). Host tidak dapat mengirimkan paket keluar karena gateway tidak dapat dijangkau secara langsung via ARP.`,
              solution: `Sesuaikan Default Gateway agar satu segmen network dengan IP host (misal IP ${node.ipConfig.ip.replace(/\.\d+$/, '')}.x maka gateway harus ${node.ipConfig.ip.replace(/\.\d+$/, '')}.1).`,
            });
          }
        }
      }
    }
  }

  // Check 9: Gateway & Subnet Mismatch with Connected Router/ONT (Physical Reachability)
  for (const node of nodes) {
    if (['pc', 'cctv', 'server', 'smartphone', 'iot'].includes(node.type) && node.poweredOn) {
      const upstream = findUpstreamGateway(node, nodes, cables);
      if (upstream && upstream.poweredOn) {
        const routerLanIp =
          upstream.type === 'ont'
            ? upstream.ontConfig?.lanIp || upstream.ipConfig?.ip || '192.168.1.1'
            : upstream.ipConfig?.ip || '192.168.88.1';
        const routerSubnet =
          upstream.type === 'ont'
            ? upstream.ontConfig?.lanSubnet || upstream.ipConfig?.subnet || '255.255.255.0'
            : upstream.ipConfig?.subnet || '255.255.255.0';

        if (node.ipConfig?.mode === 'static') {
          // Check A: Gateway mismatch with actual connected router IP
          if (node.ipConfig.gateway && node.ipConfig.gateway !== routerLanIp) {
            issues.push({
              id: `gw-mismatch-${node.id}`,
              severity: 'critical',
              title: `Gateway ${node.name} (${node.ipConfig.gateway}) Berbeda dengan Router/ONT (${routerLanIp})`,
              targetNodeId: node.id,
              category: 'ip',
              cause: `Perangkat "${node.name}" menggunakan Default Gateway "${node.ipConfig.gateway}", sedangkan terhubung fisik ke ${upstream.name} yang memiliki IP LAN "${routerLanIp}". Paket streaming kamera CCTV atau koneksi internet TIDAK DAPAT DITERUSKAN karena paket dikirim ke alamat gateway yang tidak ada di link ini!`,
              solution: `Ubah Default Gateway pada ${node.name} menjadi "${routerLanIp}", atau ubah mode konfigurasi IPv4 ke "DHCP Client" agar otomatis sinkron dengan ${upstream.name}.`,
            });
          }

          // Check B: IP Subnet mismatch with connected router LAN
          if (node.ipConfig.ip && isValidIpv4(node.ipConfig.ip) && !isSameSubnet(node.ipConfig.ip, routerLanIp, routerSubnet)) {
            issues.push({
              id: `ip-subnet-mismatch-${node.id}`,
              severity: 'critical',
              title: `IP "${node.name}" (${node.ipConfig.ip}) di Luar Subnet Router ${upstream.name} (${routerLanIp})`,
              targetNodeId: node.id,
              category: 'ip',
              cause: `Alamat IP ${node.name} (${node.ipConfig.ip}) tidak sekelas dengan subnet LAN router (${routerLanIp} / ${routerSubnet}). Router akan menolak paket karena dianggap paket asing/bukan berasal dari segmen lokal.`,
              solution: `Ganti IP perangkat ke subnet ${routerLanIp.replace(/\.\d+$/, '')}.x (misal ${routerLanIp.replace(/\.\d+$/, '')}.50) atau aktifkan DHCP.`,
            });
          }

          // Check C: IP Collision with the Gateway Router itself
          if (node.ipConfig.ip === routerLanIp) {
            issues.push({
              id: `ip-collision-gw-${node.id}`,
              severity: 'critical',
              title: `Bentrok IP Kritis: "${node.name}" Menggunakan IP Router Gateway (${routerLanIp})`,
              targetNodeId: node.id,
              category: 'ip',
              cause: `Perangkat "${node.name}" memiliki alamat IP yang persis sama dengan IP Gateway Router ${upstream.name} (${routerLanIp}). Ini memicu Gateway IP Hijacking dan melumpuhkan akses jaringan bagi seluruh perangkat!`,
              solution: `Segera ubah IP host "${node.name}" ke alamat IP lain (misal ${routerLanIp.replace(/\.\d+$/, '')}.120).`,
            });
          }
        } else if (node.ipConfig?.mode === 'dhcp') {
          // Check D: Client is in DHCP mode, but upstream router DHCP server is OFF
          const isDhcpServerOff =
            upstream.type === 'ont'
              ? upstream.ontConfig?.dhcpServerEnabled === false || (upstream.ipConfig?.isDhcpServerEnabled === false && upstream.ontConfig?.dhcpServerEnabled === undefined)
              : upstream.ipConfig?.isDhcpServerEnabled === false;

          if (isDhcpServerOff) {
            issues.push({
              id: `dhcp-server-off-${node.id}`,
              severity: 'critical',
              title: `Klien "${node.name}" Gagal Mendapat IP (DHCP Server ${upstream.name} Mati)`,
              targetNodeId: node.id,
              category: 'configuration',
              cause: `Perangkat "${node.name}" diatur dalam mode DHCP, namun layanan DHCP Server pada ${upstream.name} dimatikan (Disabled). Klien tidak memperoleh konfigurasi IP dan mengalami status APIPA (169.254.x.x).`,
              solution: `Buka panel ${upstream.name} lalu centang "Aktifkan DHCP Server", atau atur IP Statis pada ${node.name}.`,
            });
          }
        }
      }
    }
  }

  // Check 10: ONT Static WAN Configuration Incomplete
  for (const node of nodes) {
    if (node.type === 'ont' && node.poweredOn) {
      if (node.ontConfig?.wanMode === 'static') {
        if (!node.ontConfig.staticWanIp || !node.ontConfig.staticWanGateway) {
          issues.push({
            id: `ont-static-wan-${node.id}`,
            severity: 'warning',
            title: `Konfigurasi WAN Statis pada ONT "${node.name}" Belum Lengkap`,
            targetNodeId: node.id,
            category: 'configuration',
            cause: `Mode WAN dipilih Static IP, namun Alamat IP WAN Publik (${node.ontConfig.staticWanIp || 'Kosong'}) atau Gateway ISP (${node.ontConfig.staticWanGateway || 'Kosong'}) belum diisi.`,
            solution: `Buka tab Konfigurasi ONT "${node.name}" dan isi kolom IP WAN, Subnet Mask, serta Gateway ISP.`,
          });
        }
      }
    }
  }

  // Check 11: ONT in Bridge Mode with Direct Clients (No PPPoE Router Dialer)
  for (const node of nodes) {
    if (node.type === 'ont' && node.poweredOn && node.ontConfig?.wanMode === 'bridge') {
      const clientNodes = nodes.filter(
        (n) =>
          ['pc', 'cctv', 'smartphone', 'iot', 'server'].includes(n.type) &&
          findUpstreamGateway(n, nodes, cables)?.id === node.id
      );

      const hasSecondaryRouter = cables.some((c) => {
        if (c.status === 'broken' || c.type !== 'lan') return false;
        const otherId = c.fromNodeId === node.id ? c.toNodeId : c.fromNodeId;
        const otherNode = nodes.find((n) => n.id === otherId);
        return otherNode?.type === 'mikrotik' && otherNode.poweredOn;
      });

      if (!hasSecondaryRouter && clientNodes.length > 0) {
        issues.push({
          id: `ont-bridge-no-router-${node.id}`,
          severity: 'critical',
          title: `ONT "${node.name}" Mode Bridge: Klien Tidak Ada Internet Tanpa Router PPPoE`,
          targetNodeId: node.id,
          category: 'configuration',
          cause: `ONT disetel ke "Mode Bridge" (Layer 2 murni) dan DHCP server dimatikan. Dalam mode bridge, modem tidak lagi melakukan routing IP atau NAT. Perangkat klien (${clientNodes.map((c) => c.name).join(', ')}) yang tersambung langsung ke ONT TIDAK DAPAT MENGAKSES INTERNET karena tidak ada router yang melakukan dial PPPoE ke ISP!`,
          solution: `Hubungkan kabel LAN dari port ONT ke port ether1 router MikroTik untuk melakukan dial PPPoE dan aktifkan NAT, ATAU ubah kembali mode WAN ONT ke "PPPoE" / "DHCP" (Router Mode) dan aktifkan kembali DHCP Server ONT.`,
        });

        for (const client of clientNodes) {
          issues.push({
            id: `client-no-internet-bridge-${client.id}`,
            severity: 'critical',
            title: `Koneksi Internet Klien "${client.name}" Terputus (ONT Mode Bridge)`,
            targetNodeId: client.id,
            category: 'configuration',
            cause: `Perangkat "${client.name}" terhubung ke ONT "${node.name}" yang berada dalam Mode Bridge tanpa router perantara dialer PPPoE. Paket data internet tidak memiliki gateway rute keluar (No NAT/Route).`,
            solution: `Gunakan router perantara (seperti MikroTik) untuk dial PPPoE, atau ubah mode ONT kembali ke PPPoE (Router Mode).`,
          });
        }
      }
    }
  }

  // Check 8: MikroTik NAT Masquerade
  const mikrotikNodes = nodes.filter((n) => n.type === 'mikrotik' && n.poweredOn);
  for (const mk of mikrotikNodes) {
    if (mk.mikrotikConfig && !mk.mikrotikConfig.firewallNat) {
      issues.push({
        id: `nat-off-${mk.id}`,
        severity: 'critical',
        title: `MikroTik "${mk.name}": NAT Masquerade Belum Aktif`,
        targetNodeId: mk.id,
        category: 'configuration',
        cause: `Fitur Firewall NAT Masquerade dimatikan. Klien di jaringan lokal (IP Private) tidak bisa menerjemahkan alamat paket ke IP Public WAN untuk berselancar di internet.`,
        solution: `Buka pengaturan MikroTik, lalu centang opsi "Aktifkan NAT Masquerade (srcnat)" agar klien lokal dapat terhubung ke internet.`,
      });
    }
  }

  // Check 9: Switching Loop Detection (Loop back)
  const switchNodes = nodes.filter((n) => n.type === 'switch');
  for (let i = 0; i < switchNodes.length; i++) {
    for (let j = i + 1; j < switchNodes.length; j++) {
      const swA = switchNodes[i];
      const swB = switchNodes[j];
      const directLinks = cables.filter(
        (c) =>
          c.type === 'lan' &&
          c.status !== 'broken' &&
          ((c.fromNodeId === swA.id && c.toNodeId === swB.id) ||
            (c.fromNodeId === swB.id && c.toNodeId === swA.id))
      );
      if (directLinks.length > 1) {
        issues.push({
          id: `loop-${swA.id}-${swB.id}`,
          severity: 'critical',
          title: `Bahaya Switching Loop / Broadcast Storm antara ${swA.name} dan ${swB.name}`,
          category: 'topology',
          cause: `Terdapat lebih dari satu kabel LAN yang menghubungkan kedua switch ini secara paralel tanpa konfigurasi STP (Spanning Tree Protocol) atau LACP Bonding. Paket broadcast akan berputar selamanya dan melumpuhkan CPU switch.`,
          solution: `Cabut salah satu kabel LAN penghubung antar switch tersebut, atau aktifkan fitur RSTP / LACP Link Aggregation.`,
        });
      }
    }
  }

  // Check 10: LAN Cable Length exceeding 100 meters
  for (const cable of cables) {
    if (cable.type === 'lan' && cable.lengthKm > 0.10) {
      // 0.1 km = 100m
      const fromNode = nodes.find((n) => n.id === cable.fromNodeId);
      const toNode = nodes.find((n) => n.id === cable.toNodeId);
      issues.push({
        id: `lan-length-${cable.id}`,
        severity: 'warning',
        title: `Kabel LAN Terlalu Panjang (${(cable.lengthKm * 1000).toFixed(0)} meter)`,
        targetCableId: cable.id,
        category: 'physical',
        cause: `Standar IEEE 802.3 Ethernet membatasi kabel UTP maksimal 100 meter. Jarak ${(cable.lengthKm * 1000).toFixed(0)}m antara ${fromNode?.name || ''} dan ${toNode?.name || ''} akan menimbulkan penurunan kecepatan (packet loss) drastis.`,
        solution: `Gunakan perangkat perantara seperti Switch Hub sebagai pengulang (repeater), atau gunakan kabel Fiber Optik dengan Media Converter (HTB) untuk jarak jauh.`,
      });
    }
  }

  // Check 12: IEEE 802.1Q VLAN Tagging & Segregation Check
  for (const cable of cables) {
    if (cable.status === 'broken' || !['lan', 'wireless'].includes(cable.type)) continue;

    const fromNode = nodes.find((n) => n.id === cable.fromNodeId);
    const toNode = nodes.find((n) => n.id === cable.toNodeId);

    if (fromNode?.poweredOn && toNode?.poweredOn) {
      const vlanFrom = fromNode.vlanConfig;
      const vlanTo = toNode.vlanConfig;

      if (vlanFrom?.enabled && vlanTo?.enabled) {
        // Case A: Both nodes in Access mode with different VLAN IDs
        if (
          vlanFrom.mode === 'access' &&
          vlanTo.mode === 'access' &&
          vlanFrom.vlanId !== vlanTo.vlanId
        ) {
          issues.push({
            id: `vlan-mismatch-${cable.id}`,
            severity: 'critical',
            title: `Isolasi VLAN 802.1Q: ${fromNode.name} (VLAN ${vlanFrom.vlanId}) vs ${toNode.name} (VLAN ${vlanTo.vlanId})`,
            targetCableId: cable.id,
            targetNodeId: fromNode.id,
            category: 'configuration',
            cause: `Kedua perangkat terhubung langsung tetapi disetel pada VLAN yang berbeda (${fromNode.name}: VLAN ${vlanFrom.vlanId} vs ${toNode.name}: VLAN ${vlanTo.vlanId}) dalam mode Access. Standar IEEE 802.1Q memisahkan broadcast domain secara fisik di Layer 2, sehingga paket tidak dapat berkomunikasi tanpa router Inter-VLAN Routing.`,
            solution: `Samakan VLAN ID pada kedua perangkat, atau ubah salah satu port menjadi "Trunk" pada switch/router untuk melewatkan multi-VLAN.`,
          });
        }

        // Case B: One node is Access, neighbor is Trunk, but VLAN is not in Allowed VLANs
        if (vlanFrom.mode === 'access' && vlanTo.mode === 'trunk') {
          const allowed = vlanTo.allowedVlans || [];
          if (allowed.length > 0 && !allowed.includes(vlanFrom.vlanId)) {
            issues.push({
              id: `vlan-trunk-drop-${cable.id}`,
              severity: 'critical',
              title: `VLAN ${vlanFrom.vlanId} (${fromNode.name}) Ditolak oleh Port Trunk ${toNode.name}`,
              targetNodeId: fromNode.id,
              category: 'configuration',
              cause: `Port Trunk pada ${toNode.name} hanya mengizinkan VLAN [${allowed.join(', ')}]. Frame dari ${fromNode.name} (VLAN ${vlanFrom.vlanId}) akan didrop pada port switch.`,
              solution: `Tambahkan VLAN ${vlanFrom.vlanId} ke daftar Allowed VLANs pada ${toNode.name}.`,
            });
          }
        } else if (vlanTo.mode === 'access' && vlanFrom.mode === 'trunk') {
          const allowed = vlanFrom.allowedVlans || [];
          if (allowed.length > 0 && !allowed.includes(vlanTo.vlanId)) {
            issues.push({
              id: `vlan-trunk-drop-${cable.id}`,
              severity: 'critical',
              title: `VLAN ${vlanTo.vlanId} (${toNode.name}) Ditolak oleh Port Trunk ${fromNode.name}`,
              targetNodeId: toNode.id,
              category: 'configuration',
              cause: `Port Trunk pada ${fromNode.name} hanya mengizinkan VLAN [${allowed.join(', ')}]. Frame dari ${toNode.name} (VLAN ${vlanTo.vlanId}) akan didrop pada port switch.`,
              solution: `Tambahkan VLAN ${vlanTo.vlanId} ke daftar Allowed VLANs pada ${fromNode.name}.`,
            });
          }
        }
      }
    }
  }

  return issues;
}
