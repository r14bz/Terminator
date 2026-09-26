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
};
