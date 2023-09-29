import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  input: {
    backgroundColor: '#D4ABC2',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: '3.84px',
    elevation: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  switchText: {
    color: 'black',
    textAlign: 'center',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom:5
  },
  switchContainer:{
    display:'flex',
    direction:'row'
  }
});


