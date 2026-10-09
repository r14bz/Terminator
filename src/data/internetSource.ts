import type { NetworkNode } from '../types/network';

/**
 * Konfigurasi IP bawaan node "Sumber Internet" (aturan 8.0 di docs/aturan-validator-simulator.md):
 * gateway LAN sudah terisi dan DHCP server aktif, sehingga node ini langsung siap dipakai.
 *
 * Satu sumber untuk App.tsx (saat node ditambahkan), panel konfigurasi (nilai cadangan),
 * dan test, supaya alamat ini tidak tersebar sebagai literal di banyak tempat.
 */
export const INTERNET_SOURCE_IP_CONFIG: NonNullable<NetworkNode['ipConfig']> = {
  mode: 'static',
  ip: '192.168.1.1',
  subnet: '255.255.255.0',
  gateway: '',
  dns: '8.8.8.8',
  isDhcpServerEnabled: true,
  dhcpRangeStart: '192.168.1.2',
  dhcpRangeEnd: '192.168.1.254',
};
