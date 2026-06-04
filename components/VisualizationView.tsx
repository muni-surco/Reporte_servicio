import React from 'react';
import { UnitData, AppSettings } from '../types';
import Badge from './atoms/Badge';
import StatValue from './atoms/StatValue';
import Icon from './atoms/Icon';
import { DS_COLORS, DS_SPACING, DS_TYPOGRAPHY } from '../design-system/tokens';

interface VisualizationViewProps {
  allSectorsData: Record<string, { units: UnitData[]; settings: AppSettings }>;
  settings: AppSettings;
}

const VisualizationView: React.FC<VisualizationViewProps> = ({
  allSectorsData,
  settings,
}) => {
  const getStatusColor_UI = (status: string) => {
    switch (status) {
      case 'ACTIVO':
        return DS_COLORS.success;
      case 'FUERA':
        return DS_COLORS.danger;
      default:
        return DS_COLORS.info;
    }
  };

  const renderCompactUnit = (u: UnitData, type: string) => {
    const iconMap: Record<string, string> = {
      CHOFER: 'car',
      MOTO: 'bike',
      SERENO: 'shield',
    };

    return (
      <div
        key={u.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DS_SPACING.s4,
          padding: `${DS_SPACING.s2} ${DS_SPACING.s4}`,
          borderBottom: `1px solid ${DS_COLORS.gray300}`,
          transition: 'background-color 0.2s',
        }}
        className="hover:bg-slate-50 group"
      >
        {/* Status Indicator */}
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: getStatusColor_UI(u.status),
            boxShadow: `0 0 0 3px ${getStatusColor_UI(u.status)}20`,
            flexShrink: 0,
          }}
          title={u.status}
        />

        {/* Unit ID */}
        <span
          style={{
            fontSize: DS_TYPOGRAPHY.textSm,
            fontWeight: DS_TYPOGRAPHY.fontBold,
            color: DS_COLORS.primary,
            minWidth: '50px',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {u.id}
        </span>

        {/* Personnel & Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            minWidth: 0,
            gap: DS_SPACING.s6,
          }}
        >
          <p
            style={{
              fontSize: DS_TYPOGRAPHY.textSm,
              fontWeight: DS_TYPOGRAPHY.fontBold,
              color: DS_COLORS.gray900,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            {u.personnel1}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: DS_SPACING.s6,
              flexShrink: 0,
            }}
          >
            {/* Radio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: DS_SPACING.s2 }}>
              <span
                style={{
                  fontSize: DS_TYPOGRAPHY.textXs,
                  fontWeight: DS_TYPOGRAPHY.fontBold,
                  color: DS_COLORS.gray500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                RADIO:
              </span>
              <span
                style={{
                  fontSize: DS_TYPOGRAPHY.textSm,
                  fontWeight: DS_TYPOGRAPHY.fontSemibold,
                  color: DS_COLORS.gray700,
                  fontFamily: 'monospace',
                }}
              >
                {u.radio || '--'}
              </span>
            </div>

            {/* Divider */}
            <div
              style={{
                width: '1px',
                height: '20px',
                backgroundColor: DS_COLORS.gray300,
                flexShrink: 0,
              }}
            />

            {/* Quadrant */}
            <div style={{ display: 'flex', alignItems: 'center', gap: DS_SPACING.s2 }}>
              <span
                style={{
                  fontSize: DS_TYPOGRAPHY.textXs,
                  fontWeight: DS_TYPOGRAPHY.fontBold,
                  color: DS_COLORS.gray500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                CUADRANTE:
              </span>
              <span
                style={{
                  fontSize: DS_TYPOGRAPHY.textSm,
                  fontWeight: DS_TYPOGRAPHY.fontBold,
                  color: DS_COLORS.gray900,
                }}
              >
                {u.quadrant || '--'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const sectorEntries = Object.entries(allSectorsData) as [
    string,
    { units: UnitData[]; settings: AppSettings }
  ][];

  return (
    <div style={{ backgroundColor: DS_COLORS.gray100, minHeight: '100vh', paddingBottom: DS_SPACING.s10 }}>
      <div style={{ padding: DS_SPACING.s4, display: 'flex', flexDirection: 'column', gap: DS_SPACING.s6, maxWidth: '1600px', margin: '0 auto' }}>
        {sectorEntries.map(([sectorName, data]) => {
          const choferes = data.units.filter((u) => u.type === 'CHOFER');
          const motos = data.units.filter((u) => u.type === 'MOTO');
          const serenos = data.units.filter((u) => u.type === 'SERENO');
          const isRescate = sectorName === 'RESCATE';

          const operativoCount = data.units.filter((u) => u.status === 'ACTIVO').length;
          const operativityPercent = Math.round(
            (operativoCount / (data.units.length || 1)) * 100
          );

          return (
            <div
              key={sectorName}
              id={`sector-${sectorName.replace(/\s+/g, '-')}`}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: `0 8px 24px ${DS_COLORS.gray500}1a`,
                border: `1px solid ${DS_COLORS.gray300}`,
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}
              className="hover:shadow-lg"
            >
              {/* Sector Header */}
              <div
                style={{
                  background: `linear-gradient(to right, ${DS_COLORS.gray100}, white)`,
                  borderBottom: `1px solid ${DS_COLORS.gray300}`,
                  padding: `${DS_SPACING.s4} ${DS_SPACING.s6}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: DS_SPACING.s8,
                }}
              >
                {/* Sector Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: DS_SPACING.s3, minWidth: '140px', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '8px',
                      height: '32px',
                      backgroundColor: DS_COLORS.primary,
                      borderRadius: '4px',
                      boxShadow: `0 0 0 8px ${DS_COLORS.primary}15`,
                    }}
                  />
                  <h2
                    style={{
                      fontSize: DS_TYPOGRAPHY.textLg,
                      fontWeight: DS_TYPOGRAPHY.fontBold,
                      color: DS_COLORS.primaryDark,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      lineHeight: 1,
                      margin: 0,
                    }}
                  >
                    {sectorName}
                  </h2>
                </div>

                {/* Divider */}
                <div
                  style={{
                    width: '1px',
                    height: '32px',
                    backgroundColor: DS_COLORS.gray300,
                    flexShrink: 0,
                  }}
                />

                {/* Personnel Info */}
                <div
                  style={{
                    display: 'flex',
                    gap: DS_SPACING.s10,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
                    <label
                      style={{
                        fontSize: DS_TYPOGRAPHY.textXs,
                        fontWeight: DS_TYPOGRAPHY.fontBold,
                        color: DS_COLORS.gray500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: DS_SPACING.s1,
                        margin: 0,
                      }}
                    >
                      OPERADOR EN TURNO
                    </label>
                    <span
                      style={{
                        fontSize: DS_TYPOGRAPHY.textSm,
                        fontWeight: DS_TYPOGRAPHY.fontBold,
                        color: DS_COLORS.gray900,
                        textTransform: 'uppercase',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {data.settings.operador || 'NO ASIGNADO'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
                    <label
                      style={{
                        fontSize: DS_TYPOGRAPHY.textXs,
                        fontWeight: DS_TYPOGRAPHY.fontBold,
                        color: DS_COLORS.gray500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginBottom: DS_SPACING.s1,
                        margin: 0,
                      }}
                    >
                      SUPERVISOR SECTOR
                    </label>
                    <span
                      style={{
                        fontSize: DS_TYPOGRAPHY.textSm,
                        fontWeight: DS_TYPOGRAPHY.fontBold,
                        color: DS_COLORS.gray900,
                        textTransform: 'uppercase',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {data.settings.supervisor || 'NO ASIGNADO'}
                    </span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: DS_SPACING.s6,
                    flexShrink: 0,
                  }}
                >
                  <StatValue label="Unidades" value={data.units.length} />
                  <div
                    style={{
                      width: '1px',
                      height: '40px',
                      backgroundColor: DS_COLORS.gray300,
                    }}
                  />
                  <StatValue
                    label="Operatividad"
                    value={`${operativityPercent}%`}
                    color={operativoCount >= data.units.length * 0.8 ? DS_COLORS.success : DS_COLORS.warning}
                  />
                </div>
              </div>

              {/* Unit Type Grid */}
              <div
                style={{
                  padding: DS_SPACING.s4,
                  display: 'grid',
                  gap: DS_SPACING.s4,
                  gridTemplateColumns: isRescate ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                }}
              >
                {/* Choferes */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px',
                    border: `1px solid ${DS_COLORS.primary}20`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontSize: DS_TYPOGRAPHY.textSm,
                      color: DS_COLORS.primary,
                      backgroundColor: `${DS_COLORS.primary}08`,
                      padding: `${DS_SPACING.s2} ${DS_SPACING.s4}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${DS_COLORS.primary}20`,
                      fontWeight: DS_TYPOGRAPHY.fontBold,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: DS_SPACING.s2 }}>
                      <Icon name="car" size={18} color={DS_COLORS.primary} stroke={2} />
                      CHOFERES
                    </div>
                    <Badge variant="primary" size="sm">
                      {choferes.length}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
                    {choferes.map((u) => renderCompactUnit(u, 'CHOFER'))}
                    {choferes.length === 0 && (
                      <p
                        style={{
                          fontSize: DS_TYPOGRAPHY.textXs,
                          fontStyle: 'italic',
                          color: DS_COLORS.gray300,
                          padding: `${DS_SPACING.s10} 0`,
                          textAlign: 'center',
                          fontWeight: DS_TYPOGRAPHY.fontBold,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          margin: 0,
                        }}
                      >
                        Sin registros
                      </p>
                    )}
                  </div>
                </div>

                {!isRescate && (
                  <>
                    {/* Motos */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '12px',
                        border: `1px solid ${DS_COLORS.secondary}20`,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          fontSize: DS_TYPOGRAPHY.textSm,
                          color: DS_COLORS.secondary,
                          backgroundColor: `${DS_COLORS.secondary}08`,
                          padding: `${DS_SPACING.s2} ${DS_SPACING.s4}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: `1px solid ${DS_COLORS.secondary}20`,
                          fontWeight: DS_TYPOGRAPHY.fontBold,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: DS_SPACING.s2 }}>
                          <Icon name="bike" size={18} color={DS_COLORS.secondary} stroke={2} />
                          MOTORIZADOS
                        </div>
                        <Badge variant="secondary" size="sm">
                          {motos.length}
                        </Badge>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
                        {motos.map((u) => renderCompactUnit(u, 'MOTO'))}
                        {motos.length === 0 && (
                          <p
                            style={{
                              fontSize: DS_TYPOGRAPHY.textXs,
                              fontStyle: 'italic',
                              color: DS_COLORS.gray300,
                              padding: `${DS_SPACING.s10} 0`,
                              textAlign: 'center',
                              fontWeight: DS_TYPOGRAPHY.fontBold,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              margin: 0,
                            }}
                          >
                            Sin registros
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Serenos */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '12px',
                        border: `1px solid ${DS_COLORS.info}20`,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          fontSize: DS_TYPOGRAPHY.textSm,
                          color: DS_COLORS.info,
                          backgroundColor: `${DS_COLORS.info}08`,
                          padding: `${DS_SPACING.s2} ${DS_SPACING.s4}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: `1px solid ${DS_COLORS.info}20`,
                          fontWeight: DS_TYPOGRAPHY.fontBold,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: DS_SPACING.s2 }}>
                          <Icon name="shield" size={18} color={DS_COLORS.info} stroke={2} />
                          SERENOS
                        </div>
                        <Badge variant="info" size="sm">
                          {serenos.length}
                        </Badge>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
                        {serenos.map((u) => renderCompactUnit(u, 'SERENO'))}
                        {serenos.length === 0 && (
                          <p
                            style={{
                              fontSize: DS_TYPOGRAPHY.textXs,
                              fontStyle: 'italic',
                              color: DS_COLORS.gray300,
                              padding: `${DS_SPACING.s10} 0`,
                              textAlign: 'center',
                              fontWeight: DS_TYPOGRAPHY.fontBold,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              margin: 0,
                            }}
                          >
                            Sin registros
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VisualizationView;
