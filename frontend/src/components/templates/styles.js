import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  modalBackground: {
    backgroundColor: 'rgba(246, 212, 199, 0.5)', 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon:{
    marginBottom:10
  },
  modalContent: {
    backgroundColor: '#F6D4C7',
    padding: '5%',
    borderRadius: 10, 
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(246, 212, 199, 0.5)', 

  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  title: {
    fontSize: 20,
    color:'gray'
  },
  bannerContainer: {
    height: '35%',
  },
  banner: {
    width: 200,
    height: 200,
    marginHorizontal: 10,
  },
  buttonContainer: {
    height: '60%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor:'#D4B1AB',
    width:190,
    height:130,
    borderRadius:30,
    justifyContent:'flex-end',
    
  },
  buttonText: {
    fontSize: 16,
    color:'black',
    paddingBottom:15
  },
  instagramFooter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
});
export const stylesBlue = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    backgroundColor: '#4286f4',
    borderColor: '#fff',
  },
  headerText: {
    color: 'white',
  },
  hourText: {
    color: 'black',
  },
  eventContainer: {
    borderWidth: 1,
    borderColor: 'black',
  },
});

