import React from 'react';
import { UnitData, UnitStatus, Sector } from '../types';
import { SECTORS } from '../constants';

interface StatisticsViewProps {
    units: UnitData[];
}

const StatisticsView: React.FC<StatisticsViewProps> = ({ units }) => {
    // Calcular vehículos patrullando por sector
    const getPatrollingVehicles = () => {
        const stats: Record<string, { carros: number; motos: number }> = {};

        SECTORS.forEach(sector => {
            stats[sector] = { carros: 0, motos: 0 };
        });

        units.forEach(unit => {
            if (unit.status === UnitStatus.PATRULLANDO && unit.sector) {
                if (unit.type === 'CHOFER') {
                    stats[unit.sector].carros++;
                } else if (unit.type === 'MOTO') {
                    stats[unit.sector].motos++;
                }
            }
        });

        return stats;
    };

    // Calcular personal presente por sector
    const getPersonnelPresent = () => {
        const stats: Record<string, { choferes: number; motorizados: number; serenos: number; total: number }> = {};

        SECTORS.forEach(sector => {
            stats[sector] = { choferes: 0, motorizados: 0, serenos: 0, total: 0 };
        });

        units.forEach(unit => {
            if (unit.sector) {
                if (unit.type === 'CHOFER') {
                    stats[unit.sector].choferes++;
                    stats[unit.sector].total++;
                    if (unit.personnel2 && unit.personnel2.trim() !== '') {
                        stats[unit.sector].total++;
                    }
                } else if (unit.type === 'MOTO') {
                    stats[unit.sector].motorizados++;
                    stats[unit.sector].total++;
                } else if (unit.type === 'SERENO') {
                    stats[unit.sector].serenos++;
                    stats[unit.sector].total++;
                }
            }
        });

        return stats;
    };

    // NUEVA: Calcular estado operativo de vehículos
    const getVehicleStatusBreakdown = () => {
        const statusCount: Record<string, number> = {};

        Object.values(UnitStatus).forEach(status => {
            statusCount[status] = 0;
        });

        units.forEach(unit => {
            if (unit.type === 'CHOFER' || unit.type === 'MOTO') {
                statusCount[unit.status] = (statusCount[unit.status] || 0) + 1;
            }
        });

        return statusCount;
    };

    // NUEVA: Calcular tasas de disponibilidad
    const getAvailabilityRates = () => {
        const totalVehicles = units.filter(u => u.type === 'CHOFER' || u.type === 'MOTO').length;
        const patrollingVehicles = units.filter(u =>
            (u.type === 'CHOFER' || u.type === 'MOTO') && u.status === UnitStatus.PATRULLANDO
        ).length;

        const totalPersonnel = units.reduce((sum, u) => {
            if (u.type === 'CHOFER') {
                return sum + 1 + (u.personnel2 && u.personnel2.trim() !== '' ? 1 : 0);
            } else if (u.type === 'MOTO' || u.type === 'SERENO') {
                return sum + 1;
            }
            return sum;
        }, 0);

        const vehicleAvailability = totalVehicles > 0 ? (patrollingVehicles / totalVehicles) * 100 : 0;
        const personnelVehicleRatio = patrollingVehicles > 0 ? totalPersonnel / patrollingVehicles : 0;

        return {
            totalVehicles,
            patrollingVehicles,
            totalPersonnel,
            vehicleAvailability,
            personnelVehicleRatio
        };
    };

    // NUEVA: Detectar alertas y excepciones
    const getAlerts = () => {
        const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; count?: number }> = [];

        // Vehículos sin radio
        const noRadio = units.filter(u =>
            (u.type === 'CHOFER' || u.type === 'MOTO') &&
            (!u.radio || u.radio.trim() === '')
        );
        if (noRadio.length > 0) {
            alerts.push({ type: 'warning', message: 'Vehículos sin Radio', count: noRadio.length });
        }

        // Vehículos operativos sin chofer
        const noDriver = units.filter(u => u.status === UnitStatus.OPERATIVA_SIN_CHOFER);
        if (noDriver.length > 0) {
            alerts.push({ type: 'error', message: 'Vehículos sin Chofer', count: noDriver.length });
        }

        // Choferes sin móvil
        const noVehicle = units.filter(u => u.status === UnitStatus.CHOFER_SIN_MOVIL);
        if (noVehicle.length > 0) {
            alerts.push({ type: 'warning', message: 'Choferes sin Móvil', count: noVehicle.length });
        }

        // Vehículos sin documentos
        const noDocs = units.filter(u => u.status === UnitStatus.OPERATIVA_SIN_DOCUMENTOS);
        if (noDocs.length > 0) {
            alerts.push({ type: 'error', message: 'Vehículos sin Documentos', count: noDocs.length });
        }

        // Vehículos en mantenimiento
        const inMaintenance = units.filter(u =>
            u.status === UnitStatus.MAESTRANZA ||
            u.status === UnitStatus.EN_PC_X_DESPERFECTOS ||
            u.status === UnitStatus.TALLER_PARTICULAR
        );
        if (inMaintenance.length > 0) {
            alerts.push({ type: 'info', message: 'Vehículos en Mantenimiento', count: inMaintenance.length });
        }

        // Sectores con baja cobertura (menos de 2 vehículos patrullando)
        const lowCoverage = Object.entries(patrollingStats).filter(([sector, stats]) => {
            const total = stats.carros + stats.motos;
            return total < 2 && sector !== 'RESCATE' && sector !== 'GIR';
        });
        if (lowCoverage.length > 0) {
            alerts.push({
                type: 'warning',
                message: `Sectores con Baja Cobertura (<2 vehículos)`,
                count: lowCoverage.length
            });
        }

        return alerts;
    };

    const patrollingStats = getPatrollingVehicles();
    const personnelStats = getPersonnelPresent();
    const statusBreakdown = getVehicleStatusBreakdown();
    const availabilityRates = getAvailabilityRates();
    const alerts = getAlerts();

    // Calcular totales
    const totalCarros = Object.values(patrollingStats).reduce((sum, s) => sum + s.carros, 0);
    const totalMotos = Object.values(patrollingStats).reduce((sum, s) => sum + s.motos, 0);

    const totalChoferes = Object.values(personnelStats).reduce((sum, s) => sum + s.choferes, 0);
    const totalMotorizados = Object.values(personnelStats).reduce((sum, s) => sum + s.motorizados, 0);
    const totalSerenos = Object.values(personnelStats).reduce((sum, s) => sum + s.serenos, 0);
    const totalPersonnel = Object.values(personnelStats).reduce((sum, s) => sum + s.total, 0);

    // Colores para estados
    const getStatusColor = (status: string) => {
        switch (status) {
            case UnitStatus.PATRULLANDO: return 'bg-green-100 text-green-700 border-green-300';
            case UnitStatus.MAESTRANZA: return 'bg-orange-100 text-orange-700 border-orange-300';
            case UnitStatus.EN_PC_X_DESPERFECTOS: return 'bg-red-100 text-red-700 border-red-300';
            case UnitStatus.TALLER_PARTICULAR: return 'bg-red-100 text-red-700 border-red-300';
            case UnitStatus.OPERATIVA_SIN_CHOFER: return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case UnitStatus.CHOFER_SIN_MOVIL: return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case UnitStatus.OPERATIVA_SIN_DOCUMENTOS: return 'bg-red-100 text-red-700 border-red-300';
            case UnitStatus.EXPLANADA: return 'bg-slate-100 text-slate-700 border-slate-300';
            case UnitStatus.APOYO_OTRA_AREA: return 'bg-blue-100 text-blue-700 border-blue-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const getAlertIcon = (type: 'warning' | 'error' | 'info') => {
        switch (type) {
            case 'error': return { icon: 'error', color: 'text-red-600 bg-red-50 border-red-200' };
            case 'warning': return { icon: 'warning', color: 'text-amber-600 bg-amber-50 border-amber-200' };
            case 'info': return { icon: 'info', color: 'text-blue-600 bg-blue-50 border-blue-200' };
        }
    };

    return (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
            <div className="w-full mx-auto">
                {/* NUEVA SECCIÓN: Alertas y excepciones */}
                {alerts.length > 0 && (
                    <div className="mb-6 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                            <h2 className="text-[16px] font-medium text-white uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined">notification_important</span>
                                Alertas y Excepciones
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {alerts.map((alert, index) => {
                                    const alertStyle = getAlertIcon(alert.type);
                                    return (
                                        <div
                                            key={index}
                                            className={`${alertStyle.color} border-2 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow`}
                                        >
                                            <span className="material-symbols-outlined text-3xl">{alertStyle.icon}</span>
                                            <div className="flex-1">
                                                <p className="font-medium text-[13px]">{alert.message}</p>
                                                {alert.count !== undefined && (
                                                    <p className="text-2xl font-medium mt-1">{alert.count}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* NUEVA SECCIÓN: Tasas de disponibilidad */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-lg text-white">
                        <div className="flex items-center justify-between mb-3">
                            <span className="material-symbols-outlined text-5xl opacity-30">speed</span>
                            <div className="text-right">
                                <p className="text-emerald-100 text-[11px] font-medium uppercase tracking-wider">Disponibilidad</p>
                                <p className="text-5xl font-medium mt-1">{availabilityRates.vehicleAvailability.toFixed(1)}%</p>
                            </div>
                        </div>
                        <div className="border-t border-emerald-400 pt-3 mt-3">
                            <p className="text-emerald-100 text-[13px] ">
                                {availabilityRates.patrollingVehicles} de {availabilityRates.totalVehicles} vehículos patrullando
                            </p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-lg text-white">
                        <div className="flex items-center justify-between mb-3">
                            <span className="material-symbols-outlined text-5xl opacity-30">groups</span>
                            <div className="text-right">
                                <p className="text-purple-100 text-[11px] font-medium uppercase tracking-wider">Ratio Personal/Vehículo</p>
                                <p className="text-5xl font-medium mt-1">{availabilityRates.personnelVehicleRatio.toFixed(1)}</p>
                            </div>
                        </div>
                        <div className="border-t border-purple-400 pt-3 mt-3">
                            <p className="text-purple-100 text-[13px] ">
                                {availabilityRates.totalPersonnel} efectivos / {availabilityRates.patrollingVehicles} vehículos
                            </p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-6 shadow-lg text-white">
                        <div className="flex items-center justify-between mb-3">
                            <span className="material-symbols-outlined text-5xl opacity-30">local_police</span>
                            <div className="text-right">
                                <p className="text-cyan-100 text-[11px] font-medium uppercase tracking-wider">Cobertura Total</p>
                                <p className="text-5xl font-medium mt-1">{SECTORS.length}</p>
                            </div>
                        </div>
                        <div className="border-t border-cyan-400 pt-3 mt-3">
                            <p className="text-cyan-100 text-[13px] ">
                                Sectores activos en el sistema
                            </p>
                        </div>
                    </div>
                </div>

                {/* NUEVA SECCIÓN: Estado operativo de vehículos */}
                <div className="mb-6 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                        <h2 className="text-[16px] font-medium text-white uppercase tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined">analytics</span>
                            Estado Operativo de Vehículos
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {Object.entries(statusBreakdown)
                                .filter(([_, count]) => count > 0)
                                .sort((a, b) => b[1] - a[1])
                                .map(([status, count]) => (
                                    <div
                                        key={status}
                                        className={`${getStatusColor(status)} border-2 rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-all hover:scale-105`}
                                    >
                                        <p className="text-3xl font-medium mb-1">{count}</p>
                                        <p className="text-[11px] font-medium uppercase leading-tight">{status}</p>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tabla: Vehículos patrullando */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#004b93] to-[#002d5a] px-6 py-4">
                            <h2 className="text-[16px] font-medium text-white uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined">local_shipping</span>
                                Vehículos Patrullando
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider border-r border-slate-700"></th>
                                        <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider border-r border-slate-700">Carros</th>
                                        <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider">Motos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SECTORS.map((sector, index) => (
                                        <tr
                                            key={sector}
                                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors border-b border-slate-200`}
                                        >
                                            <td className="px-4 py-2.5 text-left text-[13px] font-medium text-slate-700 border-r border-slate-200">{sector}</td>
                                            <td className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800 border-r border-slate-200">{patrollingStats[sector]?.carros || 0}</td>
                                            <td className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800">{patrollingStats[sector]?.motos || 0}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                                        <td className="px-4 py-3 text-[13px] font-medium text-slate-900 uppercase border-r border-slate-300">Total</td>
                                        <td className="px-4 py-3 text-center text-lg font-medium text-[#004b93] border-r border-slate-300">{totalCarros}</td>
                                        <td className="px-4 py-3 text-center text-lg font-medium text-[#004b93]">{totalMotos}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tabla: Personal Presente */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#00a19b] to-[#007a75] px-6 py-4">
                            <h2 className="text-[16px] font-medium text-white uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined">groups</span>
                                Personal Presente
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider border-r border-slate-700"></th>
                                        <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider border-r border-slate-700">Choferes</th>
                                        <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider border-r border-slate-700">Motorizados</th>
                                        <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider border-r border-slate-700">Serenos</th>
                                        <th className="px-4 py-3 text-center text-[11px] font-medium uppercase tracking-wider bg-yellow-400 text-slate-900">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SECTORS.map((sector, index) => (
                                        <tr
                                            key={sector}
                                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-green-50 transition-colors border-b border-slate-200`}
                                        >
                                            <td className="px-4 py-2.5 text-left text-[13px] font-medium text-slate-700 border-r border-slate-200">{sector}</td>
                                            <td className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800 border-r border-slate-200">{personnelStats[sector]?.choferes || 0}</td>
                                            <td className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800 border-r border-slate-200">{personnelStats[sector]?.motorizados || 0}</td>
                                            <td className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-800 border-r border-slate-200">{personnelStats[sector]?.serenos || 0}</td>
                                            <td className="px-4 py-2.5 text-center text-[13px] font-medium text-slate-900 bg-yellow-50">{personnelStats[sector]?.total || 0}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                                        <td className="px-4 py-3 text-[14px] font-medium text-slate-900 uppercase border-r border-slate-300">Total</td>
                                        <td className="px-4 py-3 text-center text-lg font-medium text-[#00a19b] border-r border-slate-300">{totalChoferes}</td>
                                        <td className="px-4 py-3 text-center text-lg font-medium text-[#00a19b] border-r border-slate-300">{totalMotorizados}</td>
                                        <td className="px-4 py-3 text-center text-lg font-medium text-[#00a19b] border-r border-slate-300">{totalSerenos}</td>
                                        <td className="px-4 py-3 text-center text-xl font-medium text-slate-900 bg-yellow-100">{totalPersonnel}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Resumen General */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 text-[11px] font-medium uppercase tracking-wider">Carros Patrullando</p>
                                <p className="text-white text-3xl font-medium mt-1">{totalCarros}</p>
                            </div>
                            <span className="material-symbols-outlined text-white text-4xl opacity-30">directions_car</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-violet-100 text-[11px] font-medium uppercase tracking-wider">Motos Patrullando</p>
                                <p className="text-white text-3xl font-medium mt-1">{totalMotos}</p>
                            </div>
                            <span className="material-symbols-outlined text-white text-4xl opacity-30">two_wheeler</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-teal-100 text-[11px] font-medium uppercase tracking-wider">Personal Operativo</p>
                                <p className="text-white text-3xl font-medium mt-1">{totalPersonnel}</p>
                            </div>
                            <span className="material-symbols-outlined text-white text-4xl opacity-30">badge</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-amber-100 text-[11px] font-medium uppercase tracking-wider">Sectores Activos</p>
                                <p className="text-white text-3xl font-medium mt-1">{SECTORS.length}</p>
                            </div>
                            <span className="material-symbols-outlined text-white text-4xl opacity-30">map</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatisticsView;
