import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Buffer "mo:base/Buffer";
import Array "mo:base/Array";
actor StudentWall {
    public type Content = {
        #Text: Text;
        #Image: {
            text: Text;
            file: Blob;
            fileName: Text;
        };
        #Video: {
            text: Text;
            file: Blob;
            fileName: Text;
        };
    };
    public type Message = {
        id: Nat;
        userName: Text;
        content: Content;
        creator: Principal;
        vote: Int;
        voteBy: [Text];
    };
    type GetMessageResult = Result.Result<Message, Text>;
    type UpdateMessageResult = Result.Result<(), Text>;
    type DeleteMessageResult = Result.Result<(), Text>;
    type UpVoteResult = Result.Result<(), Text>;
    type DownVoteResult = Result.Result<(), Text>;
    type Order = {#less; #equal; #greater};

    var messageId : Nat = 0;
    var wall = HashMap.HashMap<Text, Message>(0, Text.equal, Text.hash);

    system func preupgrade() {
        wall := HashMap.HashMap<Text, Message>(0, Text.equal, Text.hash);
    };

    private func orderMessages (message1: Message, message2: Message): Order {
        if(message1.vote > message2.vote) {
            return #less
        };
        if(message1.vote < message2.vote) {
            return #greater
        };
            return #equal
    };

    public shared query ({caller}) func whoami (): async Text {
        return Principal.toText(caller)
    };

    public shared ({ caller }) func writeMessage(c : Content, userName: Text): async Nat {
        messageId += 1;

        let newMessage : Message = {
            id = messageId;
            userName = userName;
            vote = 0;
            content = c;
            creator = caller;
            voteBy = [];
        };

        wall.put(Nat.toText(messageId), newMessage);

        return messageId
    };

    public shared query ({ caller }) func getMessage( messageId : Nat): async GetMessageResult {
        try {
            let message = wall.get(Nat.toText(messageId));
            switch(message) {
                case null { return #err("El id introducido no es válido") };
                case (?actualMessage) {
                    return #ok(actualMessage)
                };
            }
        }
        catch(err) {
            return #err("Error");
        }
    };

    public shared ({ caller }) func updateMessage( messageId : Nat, c : Content, withFile : Bool): async UpdateMessageResult {
        try {
            let message = wall.get(Nat.toText(messageId));

            switch(message) {

                case (null) {
                    return #err("El id introducido no es válido");
                };

                case (?actualMessage) {

                    if( not Principal.equal( caller, actualMessage.creator )) {
                        return #err("Solo el creador puede actualizar el mensage");
                    };

                    let updatedMessage = {
                        id = actualMessage.id;
                        userName = actualMessage.userName;
                        vote = actualMessage.vote;
                        creator = actualMessage.creator;
                        content = c;
                        voteBy = actualMessage.voteBy;
                    };

                    wall.put(Nat.toText(messageId), updatedMessage);

                    return #ok();

                };

            };

        }
        catch(err) {
            return #err("Error");
        };
    };

    public shared ({ caller }) func deleteMessage( messageId : Nat): async DeleteMessageResult {
        try {
            let message = wall.get(Nat.toText(messageId));

            switch(message) {

                case (null) {
                    return #err("El id introducido no es válido");
                };

                case (?actualMessage) {

                    if( not Principal.equal( caller, actualMessage.creator )) {
                        return #err("Solo el creador puede eliminar el mensage");
                    };

                    wall.delete(Nat.toText(messageId));

                    return #ok();

                };

            };

        }
        catch(err) {
            return #err("Error");
        };
    };

    public shared ({caller}) func upVote( messageId : Nat ): async UpVoteResult {
        try {
            let message = wall.get(Nat.toText(messageId));

            switch(message) {

                case (null) {
                    return #err("El id introducido no es válido");
                };

                case (?actualMessage) {

                    let updatedMessage = {
                        id = actualMessage.id;
                        userName = actualMessage.userName;
                        vote = actualMessage.vote + 1;
                        creator = actualMessage.creator;
                        content = actualMessage.content;
                        voteBy = Array.append<Text>(actualMessage.voteBy, [Principal.toText(caller)]);
                    };

                    wall.put(Nat.toText(messageId), updatedMessage);

                    return #ok();

                };

            };

        }
        catch(err) {
            return #err("Error");
        };
    };

    public shared ({caller}) func downVote( messageId : Nat ): async DownVoteResult {
        try {
            let message = wall.get(Nat.toText(messageId));

            switch(message) {

                case (null) {
                    return #err("El id introducido no es válido");
                };

                case (?actualMessage) {

                    let updatedMessage = {
                        id = actualMessage.id;
                        userName = actualMessage.userName;
                        vote = actualMessage.vote - 1;
                        creator = actualMessage.creator;
                        content = actualMessage.content;
                        voteBy = Array.filter<Text>(actualMessage.voteBy, func (userId) {return userId != Principal.toText(caller)} );
                    };

                    wall.put(Nat.toText(messageId), updatedMessage);

                    return #ok();

                };

            };

        }
        catch(err) {
            return #err("Error");
        };
    };

    public shared query func getAllMessages(): async [Message] {
        let bufferOfMessages = Buffer.fromIter<Message>(wall.vals());
        return Buffer.toArray<Message>(bufferOfMessages);
    };

    public shared query func getAllMessagesRanked(): async [Message] {
        let bufferOfMessages = Buffer.fromIter<Message>(wall.vals());
        bufferOfMessages.sort(orderMessages);
        return Buffer.toArray<Message>(bufferOfMessages);
    };
}
