import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Animated } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import axios from 'axios';
import * as Location from 'expo-location';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { EXPO_PUBLIC_GOOGLE_API_KEY } from '@env';

const apiKey = EXPO_PUBLIC_GOOGLE_API_KEY;

const Map = () => {
  const [coordinates, setCoordinates] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [destination, setDestination] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const mapRef = useRef(null);

  useEffect(() => {
    getCurrentLocation();
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

  const searchLocation = async () => {
    if (!searchQuery.trim()) return Alert.alert('검색어를 입력하세요');

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data.status === 'OK') {
        const location = response.data.results[0].geometry.location;
        const newCoordinates = {
          latitude: location.lat,
          longitude: location.lng,
        };
        setCoordinates(newCoordinates);
        moveToLocation(newCoordinates);
        
        setHospitals([]);
        fetchNearbyHospitals(newCoordinates);
      } else {
        Alert.alert('검색 결과가 없습니다.');
      }
    } catch {
      Alert.alert('검색 중 오류가 발생했습니다.');
    }
  };

  const handleSelectHospital = (hospital) => {
    setSelectedHospital(hospital);
    setDestination({
      latitude: hospital.geometry.location.lat,
      longitude: hospital.geometry.location.lng,
    });
  };

  const toggleFavorite = (hospital) => {
    setFavorites((prev) => 
      prev.some(fav => fav.place_id === hospital.place_id)
        ? prev.filter(fav => fav.place_id !== hospital.place_id)
        : [...prev, hospital]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="주소 또는 장소를 입력하세요"
          placeholderTextColor="gray"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.searchButton} onPress={searchLocation}>
          <Text style={{ color: 'white' }}>검색</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <MaterialIcons name="my-location" size={24} color="white" />
        </TouchableOpacity>
      </View>

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
            onPress={() => handleSelectHospital(hospital)}
            pinColor="blue"
          />
        ))}

        {favorites.map((fav) => (
          <Marker
            key={fav.place_id}
            coordinate={{
              latitude: fav.geometry.location.lat,
              longitude: fav.geometry.location.lng,
            }}
            title={`⭐ ${fav.name}`}
            onPress={() => handleSelectHospital(fav)}
            pinColor="gold"
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
      </MapView>

      <Animated.View style={[styles.detailContainer, { transform: [{ translateY: slideAnim }] }]}> 
        {selectedHospital && (
          <>
            <Text style={styles.hospitalName}>{selectedHospital.name}</Text>
            <Text>주소: {selectedHospital.vicinity}</Text>
            <Text>평점: {selectedHospital.rating || '정보 없음'}</Text>
            <TouchableOpacity onPress={() => toggleFavorite(selectedHospital)}>
              <Text style={styles.favoriteText}>
                {favorites.some(fav => fav.place_id === selectedHospital.place_id) ? '⭐ 즐겨찾기 제거' : '☆ 즐겨찾기 추가'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedHospital(null)}>
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { 
    position: 'absolute', 
    top: 50, 
    left: 10, 
    right: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    padding: 10, 
    borderRadius: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 10,
  },
  searchInput: { flex: 1, backgroundColor: '#f2f2f2', padding: 8, borderRadius: 5 },
  searchButton: { padding: 8, backgroundColor: '#3498db', borderRadius: 5 },
  locationButton: { padding: 8, backgroundColor: '#2ecc71', borderRadius: 5 },
  map: { flex: 1 },
  detailContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20 },
  hospitalName: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  favoriteText: { fontSize: 16, color: '#e74c3c', marginVertical: 5 },
  closeButton: { marginTop: 10, padding: 10, backgroundColor: '#3498db', borderRadius: 5, alignItems: 'center' },
  closeButtonText: { color: 'white' },
});

export default Map;
