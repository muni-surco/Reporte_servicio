import { useEffect, useState } from 'react';
import { PersonnelData, ViewMode } from '../types';

declare const google: any;

export const usePersonnel = (currentView: ViewMode) => {
  const [personnelList, setPersonnelList] = useState<PersonnelData[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);

  const loadPersonnel = () => {
    setLoadingPersonnel(true);
    if (typeof google !== 'undefined' && google.script?.run) {
      google.script.run
        .withSuccessHandler((personnel: PersonnelData[]) => {
          setPersonnelList(personnel || []);
          setLoadingPersonnel(false);
        })
        .withFailureHandler((error: unknown) => {
          console.error('Failed to load personnel', error);
          setPersonnelList([]);
          setLoadingPersonnel(false);
        })
        .getPersonnelList(true);
      return;
    }

    setPersonnelList([]);
    setLoadingPersonnel(false);
  };

  useEffect(() => {
    if (currentView === 'PERSONNEL') loadPersonnel();
    // Loading is intentionally driven by the active view only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  return { personnelList, setPersonnelList, loadingPersonnel, loadPersonnel };
};
