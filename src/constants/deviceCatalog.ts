import { DeviceType, NetworkDevice, PortConfig, PortType } from '../types/network';

export interface DeviceTemplate {
  type: DeviceType;
  namePrefix: string;
  defaultName: string;
  category: 'end_device' | 'switching' | 'routing' | 'optical' | 'wireless_iot' | 'iot_smart';
  description: string;
  iconName: string;
  color: string;
  defaultPorts: Omit<PortConfig, 'id'>[];
}

export const DEVICE_TEMPLATES: Record<DeviceType, DeviceTemplate> = {
  pc: {
    type: 'pc',
    namePrefix: 'PC',
    defaultName: 'Personal Computer',
    category: 'end_device',
    description: 'Komputer desktop dengan antarmuka kabel Ethernet RJ45 untuk jaringan lokal (LAN).',
    iconName: 'Monitor',
    color: '#3b82f6',
    defaultPorts: [
      {
        name: 'GigabitEthernet0',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:1B:44:11:3A:B1',
        ipAssignment: 'static',
        ipAddress: '192.168.1.10',
        subnetMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        dnsServer: '8.8.8.8',
        speedMbps: 1000,
        portMode: 'access',
        vlanId: 1,
      },
    ],
  },
  laptop: {
    type: 'laptop',
    namePrefix: 'Laptop',
    defaultName: 'Laptop Kantor',
    category: 'end_device',
    description: 'Laptop fleksibel dilengkapi port Ethernet dan kartu jaringan nirkabel Wi-Fi.',
    iconName: 'Laptop',
    color: '#06b6d4',
    defaultPorts: [
      {
        name: 'FastEthernet0',
        type: 'ethernet_fe',
        isUp: true,
        mac: '00:1B:44:22:CD:01',
        ipAssignment: 'dhcp',
        speedMbps: 100,
        portMode: 'access',
        vlanId: 1,
      },
      {
        name: 'Wireless0',
        type: 'wireless',
        isUp: true,
        mac: '00:1B:44:22:CD:02',
        ipAssignment: 'dhcp',
        speedMbps: 300,
      },
    ],
  },
  server: {
    type: 'server',
    namePrefix: 'Server',
    defaultName: 'Data & App Server',
    category: 'end_device',
    description: 'Server aplikasi / file / DNS berperforma tinggi dengan antarmuka dual-gigabit.',
    iconName: 'Server',
    color: '#8b5cf6',
    defaultPorts: [
      {
        name: 'GigabitEthernet0/0',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:1B:44:33:EE:01',
        ipAssignment: 'static',
        ipAddress: '192.168.1.200',
        subnetMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        dnsServer: '8.8.8.8',
        speedMbps: 1000,
        portMode: 'access',
        vlanId: 1,
      },
      {
        name: 'GigabitEthernet0/1',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:1B:44:33:EE:02',
        ipAssignment: 'none',
        speedMbps: 1000,
        portMode: 'access',
        vlanId: 1,
      },
    ],
  },
  printer: {
    type: 'printer',
    namePrefix: 'Printer',
    defaultName: 'Network Printer',
    category: 'end_device',
    description: 'Printer jaringan bersama yang dapat diakses oleh semua komputer di LAN.',
    iconName: 'Printer',
    color: '#64748b',
    defaultPorts: [
      {
        name: 'FastEthernet0',
        type: 'ethernet_fe',
        isUp: true,
        mac: '00:1B:44:55:00:12',
        ipAssignment: 'static',
        ipAddress: '192.168.1.50',
        subnetMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        speedMbps: 100,
        portMode: 'access',
        vlanId: 1,
      },
    ],
  },
  smartphone: {
    type: 'smartphone',
    namePrefix: 'Smartphone',
    defaultName: 'Smartphone / Tablet',
    category: 'end_device',
    description: 'Perangkat mobile terhubung nirkabel ke Wi-Fi Access Point atau Mesh.',
    iconName: 'Smartphone',
    color: '#ec4899',
    defaultPorts: [
      {
        name: 'WLAN0',
        type: 'wireless',
        isUp: true,
        mac: '00:1B:44:88:99:AA',
        ipAssignment: 'dhcp',
        speedMbps: 433,
      },
    ],
  },
  switch: {
    type: 'switch',
    namePrefix: 'Switch',
    defaultName: 'Switch Managed L2/L3 (802.1Q)',
    category: 'switching',
    description: 'Switch 24-Port dengan manajemen VLAN 802.1Q Tagging, Trunking, dan 2 port gigabit uplink.',
    iconName: 'Network',
    color: '#10b981',
    defaultPorts: (Array.from({ length: 6 }).map((_, i) => ({
      name: `Fa0/${i + 1}`,
      type: 'ethernet_fe' as PortType,
      isUp: true,
      mac: `00:E0:F7:10:00:0${i + 1}`,
      ipAssignment: 'none' as const,
      speedMbps: 100,
      portMode: 'access' as const,
      vlanId: 1,
    })) as Omit<PortConfig, 'id'>[]).concat([
      {
        name: 'Gi0/1',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:E0:F7:10:00:09',
        ipAssignment: 'none',
        speedMbps: 1000,
        portMode: 'trunk',
        allowedVlans: [1, 10, 20, 30],
        nativeVlan: 1,
      },
      {
        name: 'Gi0/2',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:E0:F7:10:00:0A',
        ipAssignment: 'none',
        speedMbps: 1000,
        portMode: 'trunk',
        allowedVlans: [1, 10, 20, 30],
        nativeVlan: 1,
      },
    ]),
  },
  switch_hub: {
    type: 'switch_hub',
    namePrefix: 'Hub',
    defaultName: 'Switch Hub Unmanaged',
    category: 'switching',
    description: 'Hub / Unmanaged switch sederhana 5 port untuk koneksi plug-and-play antar perangkat.',
    iconName: 'Boxes',
    color: '#14b8a6',
    defaultPorts: Array.from({ length: 5 }).map((_, i) => ({
      name: `Port ${i + 1}`,
      type: 'ethernet_fe' as const,
      isUp: true,
      mac: `00:A0:C9:22:00:0${i + 1}`,
      ipAssignment: 'none' as const,
      speedMbps: 100,
      portMode: 'access' as const,
      vlanId: 1,
    })),
  },
  router: {
    type: 'router',
    namePrefix: 'Router',
    defaultName: 'Enterprise Router (OSPF/BGP)',
    category: 'routing',
    description: 'Router korporat untuk routing OSPF Area 0, BGP Autonomous System, VLAN dot1Q subinterfaces, dan NAT.',
    iconName: 'Waypoints',
    color: '#f59e0b',
    defaultPorts: [
      {
        name: 'GigabitEthernet0/0',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:D0:D3:44:00:01',
        ipAssignment: 'static',
        ipAddress: '192.168.1.1',
        subnetMask: '255.255.255.0',
        speedMbps: 1000,
      },
      {
        name: 'GigabitEthernet0/1',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:D0:D3:44:00:02',
        ipAssignment: 'static',
        ipAddress: '192.168.2.1',
        subnetMask: '255.255.255.0',
        speedMbps: 1000,
      },
      {
        name: 'GigabitEthernet0/2',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:D0:D3:44:00:03',
        ipAssignment: 'static',
        ipAddress: '10.0.0.1',
        subnetMask: '255.255.255.252',
        speedMbps: 1000,
      },
    ],
  },
  mikrotik: {
    type: 'mikrotik',
    namePrefix: 'MikroTik',
    defaultName: 'MikroTik RouterBoard (RouterOS)',
    category: 'routing',
    description: 'RouterOS MikroTik (RB750/CCR) lengkap dengan DHCP server, OSPF v2, BGP v4, VLAN, dan Simple Queues.',
    iconName: 'Cpu',
    color: '#ef4444',
    defaultPorts: [
      {
        name: 'ether1 (WAN)',
        type: 'ethernet_ge',
        isUp: true,
        mac: '48:8F:5A:11:22:01',
        ipAssignment: 'dhcp',
        speedMbps: 1000,
      },
      {
        name: 'ether2 (LAN)',
        type: 'ethernet_ge',
        isUp: true,
        mac: '48:8F:5A:11:22:02',
        ipAssignment: 'static',
        ipAddress: '192.168.88.1',
        subnetMask: '255.255.255.0',
        speedMbps: 1000,
      },
      {
        name: 'ether3',
        type: 'ethernet_ge',
        isUp: true,
        mac: '48:8F:5A:11:22:03',
        ipAssignment: 'none',
        speedMbps: 1000,
      },
      {
        name: 'ether4',
        type: 'ethernet_ge',
        isUp: true,
        mac: '48:8F:5A:11:22:04',
        ipAssignment: 'none',
        speedMbps: 1000,
      },
      {
        name: 'sfp1',
        type: 'sfp_fiber',
        isUp: true,
        mac: '48:8F:5A:11:22:05',
        ipAssignment: 'none',
        speedMbps: 1250,
      },
    ],
  },
  olt: {
    type: 'olt',
    namePrefix: 'OLT',
    defaultName: 'OLT GPON Central Office',
    category: 'optical',
    description: 'Optical Line Terminal (OLT) GPON dengan modul SFP-PON Class B+/C+ untuk mendistribusikan sinyal optik ke ODC & ONT.',
    iconName: 'Zap',
    color: '#84cc16',
    defaultPorts: [
      {
        name: 'PON 1 (Class C+)',
        type: 'pon_optical',
        isUp: true,
        mac: '74:83:C2:50:00:01',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'PON 2 (Class C+)',
        type: 'pon_optical',
        isUp: true,
        mac: '74:83:C2:50:00:02',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'Uplink-GE1',
        type: 'ethernet_ge',
        isUp: true,
        mac: '74:83:C2:50:00:03',
        ipAssignment: 'static',
        ipAddress: '10.10.10.2',
        subnetMask: '255.255.255.252',
        speedMbps: 1000,
      },
      {
        name: 'Uplink-SFP10G',
        type: 'sfp_fiber',
        isUp: true,
        mac: '74:83:C2:50:00:04',
        ipAssignment: 'none',
        speedMbps: 10000,
      },
    ],
  },
  odc: {
    type: 'odc',
    namePrefix: 'ODC',
    defaultName: 'ODC (Optical Distribution Cabinet)',
    category: 'optical',
    description: 'Kabinet ODC luar ruangan untuk terminasi kabel Feeder OLT dan pembagi sinyal primer (Splitter 1:4) ke arah ODP.',
    iconName: 'Box',
    color: '#eab308',
    defaultPorts: [
      {
        name: 'IN (Feeder OLT)',
        type: 'pon_optical',
        isUp: true,
        mac: 'BB:CC:DD:10:01:00',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 1 (To ODP)',
        type: 'pon_optical',
        isUp: true,
        mac: 'BB:CC:DD:10:01:01',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 2 (To ODP)',
        type: 'pon_optical',
        isUp: true,
        mac: 'BB:CC:DD:10:01:02',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 3 (To ODP)',
        type: 'pon_optical',
        isUp: true,
        mac: 'BB:CC:DD:10:01:03',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 4 (To ODP)',
        type: 'pon_optical',
        isUp: true,
        mac: 'BB:CC:DD:10:01:04',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
    ],
  },
  odp: {
    type: 'odp',
    namePrefix: 'ODP',
    defaultName: 'ODP (Optical Distribution Point)',
    category: 'optical',
    description: 'Kotak ODP di tiang/dinding permukiman berisi Splitter sekunder 1:8 untuk menyalurkan kabel Dropcore ke rumah pelanggan (ONT).',
    iconName: 'Boxes',
    color: '#f97316',
    defaultPorts: [
      {
        name: 'IN (From ODC)',
        type: 'pon_optical',
        isUp: true,
        mac: 'CC:DD:EE:20:01:00',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      ...Array.from({ length: 8 }).map((_, i) => ({
        name: `Port ${i + 1} (Dropcore)`,
        type: 'pon_optical' as const,
        isUp: true,
        mac: `CC:DD:EE:20:01:0${i + 1}`,
        ipAssignment: 'none' as const,
        speedMbps: 2488,
      })),
    ],
  },
  splitter: {
    type: 'splitter',
    namePrefix: 'Splitter1x4',
    defaultName: 'Optical Splitter 1:4 (Loss 7.2dB)',
    category: 'optical',
    description: 'Passive PLC Optical Splitter 1:4 memecah 1 input kabel fiber menjadi 4 jalur output dengan redaman ~7.2 dB.',
    iconName: 'Split',
    color: '#eab308',
    defaultPorts: [
      {
        name: 'IN',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:00',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 1',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:01',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 2',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:02',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 3',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:03',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 4',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:04',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
    ],
  },
  splitter_1_2: {
    type: 'splitter_1_2',
    namePrefix: 'Splitter1x2',
    defaultName: 'Optical Splitter 1:2 (Loss 3.5dB)',
    category: 'optical',
    description: 'Optical Splitter 1:2 dengan redaman rendah (~3.5 dB) untuk percabangan kabel optik 2 arah.',
    iconName: 'Split',
    color: '#ca8a04',
    defaultPorts: [
      {
        name: 'IN',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:02:01:00',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 1',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:02:01:01',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 2',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:02:01:02',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
    ],
  },
  splitter_1_4: {
    type: 'splitter_1_4',
    namePrefix: 'Splitter1x4',
    defaultName: 'Optical Splitter 1:4 (Loss 7.2dB)',
    category: 'optical',
    description: 'Passive PLC Optical Splitter 1:4 memecah 1 input kabel fiber menjadi 4 jalur output dengan redaman ~7.2 dB.',
    iconName: 'Split',
    color: '#eab308',
    defaultPorts: [
      {
        name: 'IN',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:00',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 1',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:01',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 2',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:02',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 3',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:03',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      {
        name: 'OUT 4',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:00:01:04',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
    ],
  },
  splitter_1_8: {
    type: 'splitter_1_8',
    namePrefix: 'Splitter1x8',
    defaultName: 'Optical Splitter 1:8 (Loss 10.5dB)',
    category: 'optical',
    description: 'Passive PLC Optical Splitter 1:8 rasio standar ODP memecah 1 input ke 8 jalur ONT dengan redaman ~10.5 dB.',
    iconName: 'Split',
    color: '#d97706',
    defaultPorts: [
      {
        name: 'IN',
        type: 'pon_optical',
        isUp: true,
        mac: 'AA:BB:CC:08:01:00',
        ipAssignment: 'none',
        speedMbps: 2488,
      },
      ...Array.from({ length: 8 }).map((_, i) => ({
        name: `OUT ${i + 1}`,
        type: 'pon_optical' as const,
        isUp: true,
        mac: `AA:BB:CC:08:01:0${i + 1}`,
        ipAssignment: 'none' as const,
        speedMbps: 2488,
      })),
    ],
  },
  ont: {
    type: 'ont',
    namePrefix: 'ONT',
    defaultName: 'ONT / Fiber Modem FTTH',
    category: 'optical',
    description: 'Optical Network Terminal pelanggan (Fiber Modem) dengan port PON SC/APC, Gigabit LAN, dan Wi-Fi.',
    iconName: 'Radio',
    color: '#0284c7',
    defaultPorts: [
      {
        name: 'PON-IN (SC/APC)',
        type: 'pon_optical',
        isUp: true,
        mac: 'F4:8E:38:22:90:01',
        ipAssignment: 'none',
        speedMbps: 1244,
      },
      {
        name: 'LAN 1 (GE)',
        type: 'ethernet_ge',
        isUp: true,
        mac: 'F4:8E:38:22:90:02',
        ipAssignment: 'static',
        ipAddress: '192.168.1.1',
        subnetMask: '255.255.255.0',
        speedMbps: 1000,
      },
      {
        name: 'LAN 2 (FE)',
        type: 'ethernet_fe',
        isUp: true,
        mac: 'F4:8E:38:22:90:03',
        ipAssignment: 'none',
        speedMbps: 100,
      },
      {
        name: 'Wi-Fi 2.4/5G',
        type: 'wireless',
        isUp: true,
        mac: 'F4:8E:38:22:90:04',
        ipAssignment: 'none',
        speedMbps: 867,
      },
    ],
  },
  cctv: {
    type: 'cctv',
    namePrefix: 'CCTV',
    defaultName: 'IP Camera CCTV PoE',
    category: 'wireless_iot',
    description: 'Kamera keamanan IP resolusi tinggi dengan transmisi video RTSP dan daya PoE.',
    iconName: 'Camera',
    color: '#f43f5e',
    defaultPorts: [
      {
        name: 'PoE/ETH',
        type: 'ethernet_fe',
        isUp: true,
        mac: '00:12:17:88:44:C1',
        ipAssignment: 'static',
        ipAddress: '192.168.1.120',
        subnetMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        speedMbps: 100,
      },
    ],
  },
  access_point: {
    type: 'access_point',
    namePrefix: 'AP',
    defaultName: 'Access Point Wi-Fi 6',
    category: 'wireless_iot',
    description: 'Access Point nirkabel berkecepatan tinggi menyediakan konektivitas Wi-Fi untuk banyak gadget dan IoT.',
    iconName: 'Wifi',
    color: '#8b5cf6',
    defaultPorts: [
      {
        name: 'ETH0 (PoE In)',
        type: 'ethernet_ge',
        isUp: true,
        mac: '00:26:86:77:AA:01',
        ipAssignment: 'dhcp',
        speedMbps: 1000,
      },
      {
        name: 'WLAN-5GHz',
        type: 'wireless',
        isUp: true,
        mac: '00:26:86:77:AA:02',
        ipAssignment: 'none',
        speedMbps: 1200,
      },
    ],
  },
  mesh_wifi: {
    type: 'mesh_wifi',
    namePrefix: 'MeshNode',
    defaultName: 'Mesh Wi-Fi Node',
    category: 'wireless_iot',
    description: 'Sistem Wi-Fi Mesh cerdas dengan roaming mulus dan backhaul nirkabel terdedikasi.',
    iconName: 'Share2',
    color: '#a855f7',
    defaultPorts: [
      {
        name: 'WAN/LAN1',
        type: 'ethernet_ge',
        isUp: true,
        mac: '30:B5:C2:44:55:01',
        ipAssignment: 'dhcp',
        speedMbps: 1000,
      },
      {
        name: 'LAN2',
        type: 'ethernet_ge',
        isUp: true,
        mac: '30:B5:C2:44:55:02',
        ipAssignment: 'none',
        speedMbps: 1000,
      },
      {
        name: 'Mesh-Backhaul',
        type: 'wireless',
        isUp: true,
        mac: '30:B5:C2:44:55:03',
        ipAssignment: 'none',
        speedMbps: 1200,
      },
    ],
  },
  cloud_internet: {
    type: 'cloud_internet',
    namePrefix: 'Internet',
    defaultName: 'ISP Cloud Gateway',
    category: 'routing',
    description: 'Simulasi gerbang Internet publik (ISP/WAN) dengan DNS global 8.8.8.8 & 1.1.1.1.',
    iconName: 'Cloud',
    color: '#0284c7',
    defaultPorts: [
      {
        name: 'WAN0',
        type: 'ethernet_ge',
        isUp: true,
        mac: '10:FE:ED:00:00:01',
        ipAssignment: 'static',
        ipAddress: '8.8.8.8',
        subnetMask: '255.255.255.0',
        speedMbps: 10000,
      },
    ],
  },
  // IoT Smart Devices
  sensor_temp: {
    type: 'sensor_temp',
    namePrefix: 'TempSensor',
    defaultName: 'Sensor Suhu & Kelembaban IoT',
    category: 'iot_smart',
    description: 'Sensor IoT lingkungan mengukur suhu (°C) dan kelembaban, mengirim telemetri via protokol MQTT/Wi-Fi.',
    iconName: 'Thermometer',
    color: '#06b6d4',
    defaultPorts: [
      {
        name: 'WLAN-IoT',
        type: 'wireless',
        isUp: true,
        mac: '24:0A:C4:01:23:45',
        ipAssignment: 'dhcp',
        speedMbps: 72,
      },
    ],
  },
  smart_plug: {
    type: 'smart_plug',
    namePrefix: 'SmartPlug',
    defaultName: 'Smart Plug / Stopkontak Pintar',
    category: 'iot_smart',
    description: 'Stopkontak pintar terkoneksi Wi-Fi yang dapat dikontrol ON/OFF secara otomatis berdasarkan trigger suhu atau remote.',
    iconName: 'Power',
    color: '#10b981',
    defaultPorts: [
      {
        name: 'WLAN-IoT',
        type: 'wireless',
        isUp: true,
        mac: '24:0A:C4:02:34:56',
        ipAssignment: 'dhcp',
        speedMbps: 72,
      },
    ],
  },
  smart_cam: {
    type: 'smart_cam',
    namePrefix: 'SmartCam',
    defaultName: 'Smart Security Cam IoT',
    category: 'iot_smart',
    description: 'Kamera pintar IoT dengan sensor pendeteksi gerakan (Motion Detection) dan pengiriman notifikasi otomatis.',
    iconName: 'Camera',
    color: '#f43f5e',
    defaultPorts: [
      {
        name: 'WLAN0',
        type: 'wireless',
        isUp: true,
        mac: '24:0A:C4:03:45:67',
        ipAssignment: 'dhcp',
        speedMbps: 150,
      },
      {
        name: 'ETH0',
        type: 'ethernet_fe',
        isUp: true,
        mac: '24:0A:C4:03:45:68',
        ipAssignment: 'dhcp',
        speedMbps: 100,
      },
    ],
  },
  smart_lock: {
    type: 'smart_lock',
    namePrefix: 'SmartLock',
    defaultName: 'Smart Door Lock IoT',
    category: 'iot_smart',
    description: 'Kunci pintu pintar digital terhubung nirkabel dengan status Locked/Unlocked dan log akses keamanan.',
    iconName: 'Lock',
    color: '#a855f7',
    defaultPorts: [
      {
        name: 'WLAN-IoT',
        type: 'wireless',
        isUp: true,
        mac: '24:0A:C4:04:56:78',
        ipAssignment: 'dhcp',
        speedMbps: 72,
      },
    ],
  },
  iot_hub: {
    type: 'iot_hub',
    namePrefix: 'IoTHub',
    defaultName: 'IoT Gateway & MQTT Broker',
    category: 'iot_smart',
    description: 'Gateway sentral pengumpul data sensor IoT, menjalankan MQTT Broker (Mosquitto) dan otomasi cerdas (Node-RED).',
    iconName: 'Cpu',
    color: '#3b82f6',
    defaultPorts: [
      {
        name: 'ETH0',
        type: 'ethernet_ge',
        isUp: true,
        mac: '24:0A:C4:05:67:89',
        ipAssignment: 'static',
        ipAddress: '192.168.1.150',
        subnetMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        speedMbps: 1000,
      },
      {
        name: 'WLAN-AP',
        type: 'wireless',
        isUp: true,
        mac: '24:0A:C4:05:67:8A',
        ipAssignment: 'none',
        speedMbps: 300,
      },
    ],
  },
};

export function createDeviceFromTemplate(
  type: DeviceType,
  x: number,
  y: number,
  existingCount: number = 0,
): NetworkDevice {
  const template = DEVICE_TEMPLATES[type];
  const deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const deviceName = `${template.namePrefix}_${existingCount + 1}`;

  // Unique MAC helper
  const macHex = (i: number) => {
    const hex = (existingCount * 16 + i + 1).toString(16).padStart(2, '0').toUpperCase();
    return `00:E0:4C:A1:${hex.slice(0, 2)}:${Math.floor(Math.random() * 89 + 10)}`;
  };

  const ports: PortConfig[] = template.defaultPorts.map((p, idx) => ({
    ...p,
    id: `port_${deviceId}_${idx}`,
    mac: macHex(idx),
  }));

  const device: NetworkDevice = {
    id: deviceId,
    name: deviceName,
    type,
    category: template.category,
    x,
    y,
    ports,
    status: 'online',
    cpuUsagePercent: Math.floor(Math.random() * 20 + 10),
    memoryUsagePercent: Math.floor(Math.random() * 25 + 20),
  };

  // Switch VLAN database
  if (type === 'switch') {
    device.vlans = [
      { id: 1, name: 'default' },
      { id: 10, name: 'VLAN10_Sales' },
      { id: 20, name: 'VLAN20_Engineering' },
      { id: 30, name: 'VLAN30_IoT' },
    ];
  }

  // Router configurations (OSPF, BGP, Subinterfaces)
  if (type === 'router' || type === 'mikrotik') {
    device.routingTable = [
      {
        id: `route_${Date.now()}_1`,
        network: '0.0.0.0',
        netmask: '0.0.0.0',
        gateway: '10.0.0.2',
        interfaceName: type === 'mikrotik' ? 'ether1 (WAN)' : 'GigabitEthernet0/2',
        metric: 1,
        protocol: 'STATIC',
      },
    ];

    device.dhcpServer = {
      enabled: true,
      interfaceName: type === 'mikrotik' ? 'ether2 (LAN)' : 'GigabitEthernet0/0',
      network: type === 'mikrotik' ? '192.168.88.0' : '192.168.1.0',
      netmask: '255.255.255.0',
      rangeStart: type === 'mikrotik' ? '192.168.88.10' : '192.168.1.100',
      rangeEnd: type === 'mikrotik' ? '192.168.88.200' : '192.168.1.200',
      gateway: type === 'mikrotik' ? '192.168.88.1' : '192.168.1.1',
      dns: '8.8.8.8',
      leaseTimeHours: 24,
    };

    // OSPF default config
    device.ospfConfig = {
      enabled: false,
      processId: 1,
      routerId: type === 'mikrotik' ? '192.168.88.1' : '1.1.1.1',
      areas: [
        {
          id: `area_0_${deviceId}`,
          network: '192.168.1.0',
          wildcard: '0.0.0.255',
          area: 0,
        },
      ],
      neighbors: [],
    };

    // BGP default config
    device.bgpConfig = {
      enabled: false,
      asNumber: 65001,
      routerId: '10.0.0.1',
      neighbors: [],
      advertisedNetworks: ['192.168.1.0/24'],
    };

    // Router-on-a-stick subinterfaces
    if (type === 'router') {
      device.subinterfaces = [
        {
          id: `sub_${deviceId}_10`,
          name: 'GigabitEthernet0/0.10',
          physicalPortName: 'GigabitEthernet0/0',
          vlanId: 10,
          ipAddress: '192.168.10.1',
          subnetMask: '255.255.255.0',
          isUp: true,
        },
        {
          id: `sub_${deviceId}_20`,
          name: 'GigabitEthernet0/0.20',
          physicalPortName: 'GigabitEthernet0/0',
          vlanId: 20,
          ipAddress: '192.168.20.1',
          subnetMask: '255.255.255.0',
          isUp: true,
        },
      ];
    }
  }

  // FTTH Specific Configurations
  if (type === 'olt') {
    device.opticalConfig = {
      isOLT: true,
      sfpModuleType: 'GPON_Class_C+',
      txPowerDbm: +5.0, // Class C+ typical Tx
      rxSensitivityDbm: -30.0,
      connectorType: 'SC/APC',
      calculatedRxPowerDbm: +5.0,
    };
  }

  if (type === 'odc') {
    device.opticalConfig = {
      isODC: true,
      splitRatio: '1:4',
      txPowerDbm: 0,
      rxSensitivityDbm: -32.0,
      connectorType: 'SC/APC',
    };
  }

  if (type === 'odp') {
    device.opticalConfig = {
      isODP: true,
      splitRatio: '1:8',
      txPowerDbm: 0,
      rxSensitivityDbm: -32.0,
      connectorType: 'SC/APC',
    };
  }

  if (type === 'splitter' || type === 'splitter_1_2' || type === 'splitter_1_8') {
    device.opticalConfig = {
      isSplitter: true,
      splitRatio: type === 'splitter_1_2' ? '1:2' : type === 'splitter_1_8' ? '1:8' : '1:4',
      txPowerDbm: 0,
      rxSensitivityDbm: -32.0,
      connectorType: 'SC/APC',
    };
  }

  if (type === 'ont') {
    device.opticalConfig = {
      isONT: true,
      txPowerDbm: +2.0,
      rxSensitivityDbm: -27.0,
      connectorType: 'SC/APC',
      calculatedRxPowerDbm: -19.5, // nominal fiber signal
    };
    device.wirelessConfig = {
      enabled: true,
      ssid: `FiberHome_${deviceName}`,
      password: 'password123',
      band: 'dual',
      channel: 6,
      security: 'WPA2-PSK',
    };
  }

  // Wireless IoT Configurations
  if (type === 'access_point' || type === 'mesh_wifi') {
    device.wirelessConfig = {
      enabled: true,
      ssid: `Terminator_WiFi_${existingCount + 1}`,
      password: 'wifipassword',
      band: 'dual',
      channel: 11,
      security: 'WPA2-PSK',
      isMeshNode: type === 'mesh_wifi',
    };
  }

  // IoT Smart Device Telemetry & Automation
  if (type === 'sensor_temp') {
    device.iotTelemetry = {
      deviceType: 'sensor_temp',
      temperature: 28.5,
      humidity: 62,
      mqttBrokerIp: '192.168.1.150',
      mqttTopic: 'sensors/room1/telemetry',
      automationRule: {
        enabled: true,
        conditionType: 'temp_above',
        thresholdValue: 32.0,
        action: 'turn_on_plug',
      },
    };
  }

  if (type === 'smart_plug') {
    device.iotTelemetry = {
      deviceType: 'smart_plug',
      plugState: 'OFF',
      powerWatts: 0,
      mqttBrokerIp: '192.168.1.150',
      mqttTopic: 'actuators/plug1/control',
    };
  }

  if (type === 'smart_cam') {
    device.iotTelemetry = {
      deviceType: 'smart_cam',
      motionDetected: false,
      mqttBrokerIp: '192.168.1.150',
      mqttTopic: 'security/cam1/events',
      automationRule: {
        enabled: true,
        conditionType: 'motion',
        action: 'turn_on_plug',
      },
    };
    device.cctvConfig = {
      rtspUrl: `rtsp://192.168.1.${130 + existingCount}:554/live/sub`,
      resolution: '1080p',
      fps: 30,
      motionDetected: false,
      irNightVision: true,
      poePowered: false,
    };
  }

  if (type === 'smart_lock') {
    device.iotTelemetry = {
      deviceType: 'smart_lock',
      lockState: 'LOCKED',
      mqttBrokerIp: '192.168.1.150',
      mqttTopic: 'access/door1/state',
    };
  }

  if (type === 'iot_hub') {
    device.iotTelemetry = {
      deviceType: 'iot_hub',
      mqttBrokerIp: '192.168.1.150',
      mqttTopic: '#',
      lastMessage: 'MQTT Broker Mosquitto running on port 1883. Telemetry active.',
    };
  }

  if (type === 'cctv') {
    device.cctvConfig = {
      rtspUrl: `rtsp://192.168.1.120:554/live/ch0`,
      resolution: '1080p',
      fps: 30,
      motionDetected: false,
      irNightVision: true,
      poePowered: true,
    };
  }

  return device;
}
