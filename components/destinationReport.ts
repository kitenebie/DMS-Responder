import { create } from 'zustand';
import { fetchIncomingIncident } from '../src/mockData';

interface DestinationState {
  destinationCoords: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
  fetchDestination: () => Promise<void>;
  setDestinationCoords: (coords: { lat: number; lng: number } | null) => void;
  clearDestination: () => void;
}

export const useDestinationStore = create<DestinationState>((set) => ({
  destinationCoords: null,
  isLoading: false,
  error: null,

  fetchDestination: async () => {
    set({ isLoading: true, error: null });
    try {
      const incident = await fetchIncomingIncident();
      set({
          destinationCoords: {
              lat: incident.coordinates?.lat ?? 0,
              lng: incident.coordinates?.lng ?? 0,
            },
            isLoading: false,
        });
        console.log(`incident.coordinates.lat:  ${incident.coordinates?.lat}`);
        console.log(`incident.coordinates.lng:  ${incident.coordinates?.lng}`);
    } catch (error) {
      set({ error: 'Failed to fetch destination', isLoading: false });
    }
  },

  setDestinationCoords: (coords) => {
    set({ destinationCoords: coords });
  },

  clearDestination: () => {
    set({ destinationCoords: null, error: null });
  },
}));
