import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Animated, FlatList } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import axios from 'axios';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { EXPO_PUBLIC_GOOGLE_API_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiKey = EXPO_PUBLIC_GOOGLE_API_KEY;
const Map = () => {
  const [coordinates, setCoordinates] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); // 자동완성 검색어 상태 추가
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [destination, setDestination] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const mapRef = useRef(null);
  const searchTimeoutRef = useRef(null);


  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem('favorites');
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error('즐겨찾기 불러오기 오류:', error);
    }
  };

  const saveFavorites = async (newFavorites) => {
    try {
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('즐겨찾기 저장 오류:', error);
    }
  };

  const toggleFavorite = (hospital) => {
    let updatedFavorites;
    if (favorites.some((fav) => fav.place_id === hospital.place_id)) {
      updatedFavorites = favorites.filter((fav) => fav.place_id !== hospital.place_id);
    } else {
      updatedFavorites = [...favorites, hospital];
    }
    saveFavorites(updatedFavorites);
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    loadFavorites();
  }, []);

  useEffect(() => {
    if (coordinates) fetchNearbyHospitals(coordinates);
  }, [coordinates]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: selectedHospital ? 0 : 500,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [selectedHospital]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim()) fetchAutocompleteSuggestions();
    }, 500);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('위치 권한을 허용해주세요');

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCoordinates(newCoordinates);
      moveToLocation(newCoordinates);
    } catch {
      Alert.alert('현재 위치를 가져올 수 없습니다.');
    }
  };

  const moveToLocation = (location) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const fetchNearbyHospitals = async (location) => {
    try {
      if (!location) return;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=5000&type=veterinary_care&key=${apiKey}`;
      const response = await axios.get(url);
      if (response.data.status === 'OK') setHospitals(response.data.results);
    } catch {
      Alert.alert('근처 동물병원 정보를 가져오는 중 오류 발생');
    }
  };

  const fetchAutocompleteSuggestions = async () => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data.status === 'OK') {
        setSuggestions(response.data.predictions);
      }
    } catch {
      setSuggestions([]);
    }
  };

  const searchLocation = async (placeId) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data.status === 'OK') {
        const location = response.data.result.geometry.location;
        const newCoordinates = {
          latitude: location.lat,
          longitude: location.lng,
        };
        setCoordinates(newCoordinates);
        moveToLocation(newCoordinates);

        setHospitals([]);
        fetchNearbyHospitals(newCoordinates);
        setSuggestions([]);
        setSearchQuery(response.data.result.name);
      }
    } catch {
      Alert.alert('검색 중 오류가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="주소 또는 장소를 입력하세요"
          placeholderTextColor="gray"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (!text.trim()) setSuggestions([]); // 🔥 검색어가 비어있으면 자동완성 목록 숨기기
          }}
          onFocus={() => {
            if (searchQuery.trim()) fetchAutocompleteSuggestions(); // 🔥 검색창 클릭 시 검색어가 있으면 자동완성 목록 표시
          }}
          onBlur={() => setSuggestions([])} // 🔥 검색창을 벗어나면 자동완성 목록 숨기기
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => searchQuery.trim() && fetchAutocompleteSuggestions()}>
          <Text style={{ color: 'white' }}>검색</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <MaterialIcons name="my-location" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {coordinates && destination && (
        <MapViewDirections
          origin={coordinates}
          destination={destination}
          apikey={apiKey}
          strokeWidth={4}
          strokeColor="blue"
          mode="DRIVING"
        />
      )}

      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.place_id}
          style={styles.suggestionsList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.suggestionItem} onPress={() => searchLocation(item.place_id)}>
              <Text>{item.description}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <MapView
        ref={mapRef}
        initialRegion={{
          latitude: coordinates?.latitude || 37.5665,
          longitude: coordinates?.longitude || 126.9780,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        style={styles.map}
      >
        {coordinates && <Marker coordinate={coordinates} title="내 위치" pinColor="red" />}

        {hospitals.map((hospital) => (
          <Marker
            key={hospital.place_id}
            coordinate={{
              latitude: hospital.geometry.location.lat,
              longitude: hospital.geometry.location.lng,
            }}
            title={hospital.name}
            onPress={() => {
              setSelectedHospital(hospital);
              setDestination({
                latitude: hospital.geometry.location.lat,
                longitude: hospital.geometry.location.lng,
              }); // 🔥 목적지 설정 추가
            }}
            pinColor="blue"
          />

        ))}

        {coordinates && destination && (
          <MapViewDirections
            origin={coordinates}
            destination={destination}
            apikey={apiKey}
            strokeWidth={4}
            strokeColor="blue"
            mode="DRIVING"
          />
        )}
        {favorites.map((fav) => (
          <Marker
            key={fav.place_id}
            coordinate={{
              latitude: fav.geometry.location.lat,
              longitude: fav.geometry.location.lng,
            }}
            title={fav.name}
            pinColor="gold" // 즐겨찾기 병원은 골드 색상으로 표시
          />
        ))}
      </MapView>

      <Animated.View style={[styles.detailContainer, { transform: [{ translateY: slideAnim }] }]}>
        {selectedHospital && (
          <>
            <Text style={styles.hospitalName}>{selectedHospital.name}</Text>
            <Text>주소: {selectedHospital.vicinity}</Text>
            <Text>평점: {selectedHospital.rating || '정보 없음'}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedHospital(null)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={() => toggleFavorite(selectedHospital)}
            >
              <Text style={styles.favoriteButtonText}>
                {favorites.some((fav) => fav.place_id === selectedHospital.place_id) ? '즐겨찾기 제거' : '즐겨찾기 추가'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { position: 'absolute', top: 50, left: 10, right: 10, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  searchInput: { flex: 1, backgroundColor: '#f2f2f2', padding: 8, borderRadius: 5 },
  searchButton: { padding: 8, backgroundColor: '#3498db', borderRadius: 5 },
  locationButton: { padding: 8, backgroundColor: '#2ecc71', borderRadius: 5 },
  suggestionsList: { position: 'absolute', top: 90, left: 10, right: 10, backgroundColor: 'white', zIndex: 11 },
  suggestionItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  map: { flex: 1 },
  detailContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20 },
  hospitalName: { fontSize: 18, fontWeight: 'bold' },
  closeButton: { marginTop: 10, padding: 10, backgroundColor: '#3498db', borderRadius: 5 },
  closeButtonText: { color: 'white' },
  favoriteButton: { marginTop: 10, padding: 10, backgroundColor: '#f1c40f', borderRadius: 5 },
  favoriteButtonText: { color: 'black', fontWeight: 'bold', textAlign: 'center' },

});

export default Map;
