import axios from 'axios';

const GOOGLE_API_KEY = "AIzaSyDl72VmnmlfT1yxxuQYUnkEuoqa9AGe_Cc";

export const fetchPlaceSuggestions = async (input: string) => {
  if (!input) return [];

  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
    {
      params: {
        input,
        key: GOOGLE_API_KEY,
        components: 'country:us',
      },
    }
  );

  return response.data.predictions;
};

export const fetchPlaceDetails = async (placeId: string) => {
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/place/details/json`,
    {
      params: {
        place_id: placeId,
        key: GOOGLE_API_KEY,
        fields: 'formatted_address,geometry',
      },
    }
  );

  return response.data.result;
};
