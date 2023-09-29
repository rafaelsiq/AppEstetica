import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bannerContainer: {
    width: '100%', // Garante que o banner ocupe toda a largura da tela
    height: 200, // Defina a altura desejada para seus banners
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover', // Ajusta o modo de exibição da imagem conforme necessário
  },
});