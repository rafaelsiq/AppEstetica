import React from 'react';
import { Dimensions, Image, View } from 'react-native';
import { styles } from './styles';
import Carousel from 'react-native-banner-carousel';

const banners = [
  { id: '1', imageUrl: 'https://as1.ftcdn.net/v2/jpg/04/80/04/14/1000_F_480041489_mKoB0nBFqtgot8taRfVN5iCCobXVXeiR.jpg' },
  { id: '2', imageUrl: 'https://vanduarte.com.br/wp-content/uploads/2015/02/post-novidades-de-beleza-coluna-mayara-alonso-banner-300x125.jpg' },
  { id: '3', imageUrl: 'https://as1.ftcdn.net/v2/jpg/04/80/04/14/1000_F_480041489_mKoB0nBFqtgot8taRfVN5iCCobXVXeiR.jpg' },
];
const BannerWidth = Dimensions.get('window').width;
const BannerHeight = 260;

const bannerImage = (image, index) => {
  return (
    <View key={index}>
      <Image style={{ width: BannerWidth-20, marginLeft:10,height: BannerHeight, borderRadius:5 }} source={{ uri: image }} />
    </View>
  );
}

const BannerCarousel = () => {
  return (
    <View style={styles.container}>
      <Carousel
        autoplay
        autoplayTimeout={45000}
        loop
        index={0}
        pageSize={BannerWidth}
      >
        {banners.map((image) => bannerImage(image.imageUrl, image.id))}
      </Carousel>
    </View>
  );
};

export default BannerCarousel;