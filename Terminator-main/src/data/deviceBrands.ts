import type { NodeType } from '../types/network';

export interface DeviceBrandModel {
  brand: string;
  models: string[];
}

/**
 * Brand/model catalog per device type. Deliberately Partial: only the types a
 * technician would actually shop for are listed (ont, olt, mikrotik, switch,
 * router, cctv, htb, pc). The remaining NodeTypes — internet, metro, odc, odp,
 * splitter, mesh, smartphone, iot, server — have no brand to pick, which is why
 * callers fall back to the generic model name.
 */
export const DEVICE_BRANDS: Partial<Record<NodeType, DeviceBrandModel[]>> = {
  ont: [
    {
      brand: 'ZTE',
      models: ['ZTE ZXHN F609 (GPON 4GE+Wi-Fi)', 'ZTE ZXHN F670L Dual-Band AC1200', 'ZTE F660 GPON Modem'],
    },
    {
      brand: 'Huawei',
      models: ['Huawei EchoLife HG8245H (Indihome Standard)', 'Huawei EchoLife HG8245W5 Dual-Band', 'Huawei OptiXstar EG8145V5'],
    },
    {
      brand: 'Fiberhome',
      models: ['Fiberhome AN5506-04-F GPON ONU', 'Fiberhome HG680-P Modem Gateway'],
    },
    {
      brand: 'Nokia',
      models: ['Nokia G-2425G-A GPON ONT', 'Nokia 7368 ISAM ONT'],
    },
    {
      brand: 'TP-Link',
      models: ['TP-Link XC220-G3v XPON ONT', 'TP-Link TX-6610 1-Port Gigabit GPON'],
    },
  ],
  olt: [
    {
      brand: 'ZTE',
      models: ['ZTE ZXA10 C320 (Mini-OLT 2U 16-PON)', 'ZTE ZXA10 C300 Core Chassis', 'ZTE C620 Next-Gen PON'],
    },
    {
      brand: 'Huawei',
      models: ['Huawei SmartAX MA5608T Mini-OLT', 'Huawei SmartAX MA5800-X7 10G PON', 'Huawei MA5683T Medium OLT'],
    },
    {
      brand: 'Fiberhome',
      models: ['Fiberhome AN5516-04 Mini OLT', 'Fiberhome AN5116-06B Core OLT'],
    },
    {
      brand: 'V-Sol',
      models: ['V-Sol V1600G1-B 8-Port GPON OLT', 'V-Sol V1600D4 EPON 4-Port OLT'],
    },
    {
      brand: 'HIOSO',
      models: ['HIOSO HA7302CS 2-Port Standalone OLT', 'HIOSO HA7304 4-Port EPON OLT'],
    },
  ],
  mikrotik: [
    {
      brand: 'MikroTik',
      models: [
        'MikroTik RB750Gr3 (hEX Gigabit 5-Port)',
        'MikroTik RB4011iGS+RM (10x Gigabit + SFP+ 10G)',
        'MikroTik CCR2004-16G-2S+ (Cloud Core Router)',
        'MikroTik hAP ac2 (Dual-Band Router)',
        'MikroTik RB1100AHx4 (13-Port Core Router)',
      ],
    },
  ],
  switch: [
    {
      brand: 'TP-Link',
      models: ['TP-Link TL-SG108 8-Port Gigabit Desktop', 'TP-Link TL-SG1016D 16-Port Rackmount', 'TP-Link JetStream TL-SG2210P PoE'],
    },
    {
      brand: 'Cisco',
      models: ['Cisco Catalyst 2960-X 24TS-L Gigabit', 'Cisco Business CBS250-24T Managed', 'Cisco SG350-10P PoE'],
    },
    {
      brand: 'Ruijie / Reyee',
      models: ['Ruijie Reyee RG-ES108GD Gigabit Unmanaged', 'Ruijie Reyee RG-ES209GC-P Cloud Managed PoE'],
    },
    {
      brand: 'D-Link',
      models: ['D-Link DGS-1008A 8-Port Gigabit', 'D-Link DGS-1210-28 Managed Smart Switch'],
    },
    {
      brand: 'MikroTik',
      models: ['MikroTik CRS326-24G-2S+RM (Cloud Router Switch)', 'MikroTik CSS106-5G-1S FiberBox'],
    },
  ],
  router: [
    {
      brand: 'TP-Link',
      models: ['TP-Link Archer AX12 Wi-Fi 6 Gigabit', 'TP-Link Archer C6 Dual-Band AC1200', 'TP-Link Deco M4 Mesh Wi-Fi'],
    },
    {
      brand: 'Ubiquiti',
      models: ['UniFi U6-Lite Wi-Fi 6 Access Point', 'UniFi U6-Pro Enterprise AP', 'UniFi Dream Machine (UDM)'],
    },
    {
      brand: 'Tenda',
      models: ['Tenda AC10U AC1200 Smart Router', 'Tenda Nova MW6 Mesh Wi-Fi System'],
    },
    {
      brand: 'Ruijie',
      models: ['Ruijie Reyee RG-EW1200G PRO Gigabit Wi-Fi', 'Ruijie Reyee RG-RAP2200(E) Ceiling AP'],
    },
  ],
  cctv: [
    {
      brand: 'Hikvision',
      models: ['Hikvision DS-2CD2143G2-I 4MP ColorVu PoE', 'Hikvision DS-2CD1023G0-I 2MP Bullet IP Cam'],
    },
    {
      brand: 'Dahua',
      models: ['Dahua DH-IPC-HFW1230S 2MP Starlight Bullet', 'Dahua DH-IPC-HDW2431T 4MP WDR Eyeball IP Cam'],
    },
    {
      brand: 'TP-Link Tapo',
      models: ['Tapo C310 Outdoor Security Wi-Fi Cam', 'Tapo C200 Pan/Tilt Home Security Cam'],
    },
    {
      brand: 'Ezviz',
      models: ['Ezviz C3WN Wi-Fi Camera', 'Ezviz C8C 360 Pan-Tilt Camera'],
    },
  ],
  htb: [
    {
      brand: 'Netlink',
      models: ['Netlink HTB-3100 A/B 10/100M Single Mode', 'Netlink HTB-GS-03 Gigabit 1000M Single Core'],
    },
    {
      brand: 'Zimmlink',
      models: ['Zimmlink MC-1100 Fast Ethernet SC', 'Zimmlink Giga-1000 Gigabit Media Converter'],
    },
  ],
  pc: [
    {
      brand: 'Dell',
      models: ['Dell OptiPlex 7090 Desktop Workstation', 'Dell Latitude 5420 Laptop Teknisi'],
    },
    {
      brand: 'Lenovo',
      models: ['Lenovo ThinkCentre M70q Tiny PC', 'Lenovo ThinkPad T14 Workstation'],
    },
    {
      brand: 'HP',
      models: ['HP ProDesk 400 G7 Microtower', 'HP EliteBook 840 G8'],
    },
    {
      brand: 'Custom PC',
      models: ['Custom Rig PC Core i5 / 16GB RAM / Gigabit NIC'],
    },
  ],
  switch_managed: [
    {
      brand: 'Cisco',
      models: [
        'Cisco Catalyst 2960-X 24TS-L (24 GE + 4 SFP)',
        'Cisco Business CBS350-24T-4G Managed L3',
        'Cisco SG350-28P Managed PoE+ Gigabit',
      ],
    },
    {
      brand: 'MikroTik',
      models: [
        'MikroTik CRS326-24G-2S+RM (Cloud Router Switch 24G + 2 SFP+)',
        'MikroTik CSS326-24G-2S+RM (SwOS Smart Switch)',
        'MikroTik CRS328-24P-4S+RM (24 PoE+ 500W + 4 SFP+)',
      ],
    },
    {
      brand: 'Ruijie / Reyee',
      models: [
        'Ruijie Reyee RG-NBS3100-24GT4SFP Managed L2',
        'Ruijie Reyee RG-NBS3200-24GT4XS 10G Uplink',
        'Ruijie RG-NBS5100-24GT4SFP Enterprise Managed',
      ],
    },
    {
      brand: 'TP-Link',
      models: [
        'TP-Link JetStream TL-SG3428 24-Port L2+ Managed',
        'TP-Link JetStream TL-SG3428MP PoE+ 384W',
        'TP-Link JetStream TL-SG3428XF (Full 10G SFP+)',
      ],
    },
  ],
  ap_ptp: [
    {
      brand: 'Ubiquiti',
      models: [
        'Ubiquiti airMAX LiteBeam 5AC Gen2 (23dBi Dish)',
        'Ubiquiti PowerBeam 5AC Gen2 (25dBi 25+ km)',
        'Ubiquiti NanoStation 5AC Loco (Outdoor CPE)',
        'Ubiquiti airFiber 60 HD (60GHz 1Gbps mmWave)',
      ],
    },
    {
      brand: 'MikroTik',
      models: [
        'MikroTik Wireless Wire Dish 60GHz (1Gbps 1.5km)',
        'MikroTik SXTsq 5 ac (16dBi Integrated Antenna)',
        'MikroTik DISC Lite5 ac (21dBi 5GHz Long Range)',
        'MikroTik NetMetal ac2 (Heavy Duty IP54 Outdoor)',
      ],
    },
    {
      brand: 'Ruijie / Reyee',
      models: [
        'Ruijie Reyee RG-EST350 V2 Wireless Bridge (5km 5GHz)',
        'Ruijie Reyee RG-EST310 V2 Wireless Bridge (1km)',
      ],
    },
    {
      brand: 'TP-Link Pharos',
      models: [
        'TP-Link Pharos CPE710 (5GHz 867Mbps 23dBi Dish)',
        'TP-Link Pharos CPE510 (5GHz 300Mbps 13dBi)',
      ],
    },
  ],
  mesh: [
    {
      brand: 'TP-Link Deco',
      models: [
        'TP-Link Deco X20 (Wi-Fi 6 AX1800 Mesh Node)',
        'TP-Link Deco M4 (AC1200 Seamless Roaming)',
        'TP-Link Deco X50 PoE (Wi-Fi 6 Multi-Gigabit)',
        'TP-Link Deco XE75 (Wi-Fi 6E Tri-Band)',
      ],
    },
    {
      brand: 'ASUS AiMesh',
      models: [
        'ASUS ZenWiFi XT8 (AX6600 Tri-Band Mesh)',
        'ASUS RT-AX58U AiMesh Router Node',
        'ASUS ZenWiFi XD6 (AX5400 Dual-Band)',
      ],
    },
    {
      brand: 'Mercusys Halo',
      models: [
        'Mercusys Halo H50G (AC1900 Gigabit Mesh)',
        'Mercusys Halo H80X (Wi-Fi 6 Dual-Band Mesh)',
      ],
    },
    {
      brand: 'Google',
      models: [
        'Google Nest Wifi Pro (Wi-Fi 6E Mesh Node)',
        'Google Wifi Mesh Router',
      ],
    },
  ],
  access_point: [
    {
      brand: 'Ubiquiti UniFi',
      models: [
        'Ubiquiti UniFi U6-Pro (Wi-Fi 6 AX5400 PoE)',
        'Ubiquiti UniFi U6-Lite (Wi-Fi 6 Compact AP)',
        'Ubiquiti UniFi U6-Enterprise (6GHz Tri-Band 2.5G)',
        'Ubiquiti UniFi nanoHD (4x4 MU-MIMO Wave 2)',
      ],
    },
    {
      brand: 'Ruijie / Reyee',
      models: [
        'Ruijie Reyee RG-RAP2260(G) Wi-Fi 6 AX1800 AP',
        'Ruijie Reyee RG-RAP6260(H) Outdoor Wi-Fi 6 AP',
        'Ruijie Reyee RG-RAP1200(F) Wall-Plate In-Wall AP',
      ],
    },
    {
      brand: 'TP-Link Omada',
      models: [
        'TP-Link Omada EAP653 (AX3000 Ceiling Mount PoE)',
        'TP-Link Omada EAP610 (AX1800 Gigabit PoE AP)',
        'TP-Link Omada EAP225-Outdoor (AC1200 Weatherproof)',
      ],
    },
    {
      brand: 'Aruba',
      models: [
        'Aruba Instant On AP22 (Wi-Fi 6 Cloud Managed)',
        'Aruba Instant On AP11 (Desktop / Ceiling AP)',
      ],
    },
  ],
  firewall: [
    {
      brand: 'Fortinet',
      models: [
        'Fortinet FortiGate 60F (Next-Gen Firewall / UTM)',
        'Fortinet FortiGate 40F (Branch Office Security)',
        'Fortinet FortiGate 100F (Dual 10GE SFP+ Mid-Enterprise)',
      ],
    },
    {
      brand: 'Netgate / pfSense',
      models: [
        'Netgate 6100 pfSense Plus (2.5GbE / 10GbE SFP+)',
        'Netgate 4100 pfSense Plus Security Gateway',
        'pfSense Custom Box (Hardware Firewall Appliance)',
      ],
    },
    {
      brand: 'Sophos',
      models: [
        'Sophos XGS 116 (Xstream Architecture Firewall)',
        'Sophos XGS 87 Desktop Firewall Appliance',
      ],
    },
  ],
  nas: [
    {
      brand: 'Synology',
      models: [
        'Synology DiskStation DS923+ (4-Bay 10GbE Ready)',
        'Synology DiskStation DS220+ (2-Bay Compact NAS)',
        'Synology RackStation RS1221+ (8-Bay 2U Rackmount)',
      ],
    },
    {
      brand: 'QNAP',
      models: [
        'QNAP TS-464 (4-Bay Quad-Core Dual 2.5GbE)',
        'QNAP TS-253D (2-Bay Dual 2.5GbE Multimedia)',
      ],
    },
    {
      brand: 'Hikvision NVR',
      models: [
        'Hikvision DS-7608NI-K2 (8-Channel 4K NVR)',
        'Hikvision DS-7616NI-I2/16P (16-Channel PoE NVR)',
      ],
    },
  ],
  laptop: [
    {
      brand: 'Lenovo',
      models: ['Lenovo ThinkPad X1 Carbon (Intel Wi-Fi 6E + RJ45)', 'Lenovo ThinkPad T14 Workstation'],
    },
    {
      brand: 'Dell',
      models: ['Dell Latitude 5430 Business Laptop', 'Dell XPS 15 Gigabit Workstation'],
    },
    {
      brand: 'HP',
      models: ['HP EliteBook 840 G9 (Wi-Fi 6 + GbE)', 'HP ProBook 450 G9'],
    },
    {
      brand: 'Apple',
      models: ['MacBook Pro 14 M3 (Wi-Fi 6E + USB-C GbE)', 'MacBook Air 13 M2'],
    },
  ],
  printer: [
    {
      brand: 'Epson',
      models: ['Epson L5290 Wi-Fi All-in-One Ink Tank', 'Epson EcoTank L6270 Duplex Network Printer', 'Epson WorkForce Pro WF-C579R'],
    },
    {
      brand: 'HP',
      models: ['HP LaserJet Pro M404dn (Gigabit Ethernet)', 'HP Smart Tank 750 Wi-Fi Duplex'],
    },
    {
      brand: 'Canon',
      models: ['Canon imageCLASS MF244dw (Wi-Fi/LAN Laser)', 'Canon PIXMA G7070 All-In-One'],
    },
  ],
  voip_phone: [
    {
      brand: 'Yealink',
      models: [
        'Yealink SIP-T31P (2-Line Gigabit PoE IP Phone)',
        'Yealink SIP-T46U (16-Line Executive Color IP Phone)',
        'Yealink W73P Cordless DECT IP Phone',
      ],
    },
    {
      brand: 'Grandstream',
      models: [
        'Grandstream GXP1625 (2-Line PoE HD Audio)',
        'Grandstream GRP2614 (Carrier-Grade IP Phone Wi-Fi)',
      ],
    },
    {
      brand: 'Cisco',
      models: [
        'Cisco IP Phone 8841 (Gigabit PoE Executive Phone)',
        'Cisco CP-7821 IP Phone (2-Line Voice VLAN)',
      ],
    },
  ],
};
