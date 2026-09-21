import {View, Text} from 'react-native'
import { StyleSheet } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'


const about = () => {
    return(
    <View style={styles.randomass}>
        <Text>Random ass Page</Text>
    </View>)
}

const styles =  StyleSheet.create({
    randomass :{
        flex: 1,
        justifyContent: 'center',
        alignContent: 'center'
    }
})
export default about;